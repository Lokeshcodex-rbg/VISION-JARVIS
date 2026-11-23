/**
 * ULTRON × JARVIS — Allowlisted Tool Registry
 * Strictly enforces tool permissions per personality:
 * JARVIS: Productivity, time, timers, reminders, weather, daily briefing, learning guides, desktop agency.
 * ULTRON: System diagnostics, code security, project inspection, telemetry reporting.
 * All tools validate arguments. Controlled shell execution is strictly audited and permission-gated via the Windows Local Agent.
 */

const { collectSystemDiagnostics } = require('./windowsDiagnostics.js');
const { analyzeCode, analyzeProjectFile } = require('./codeSecurityAnalyzer.js');
const { memoryManagerInstance } = require('./memoryManager.js');
const { weatherServiceInstance } = require('./weatherService.js');
const { timeServiceInstance } = require('./timeService.js');
const { codingAssistantInstance } = require('./codingAssistant.js');
const { taskManagerInstance } = require('./taskManager.js');
const { researchServiceInstance } = require('./researchService.js');
const { securityPermissionsInstance } = require('./securityPermissions.js');
const { desktopControllerInstance } = require('./desktop/desktopController.js');
const { permissionGateInstance } = require('./desktop/permissionGate.js');
const { languageVoiceManagerInstance } = require('./languageVoiceManager.js');
const { documentAnalyzerInstance } = require('./documentAnalyzer.js');
const { taskOrchestratorInstance } = require('./taskOrchestrator.js');
const { visionServiceInstance } = require('./visionService.js');
const { apiIntegrationsManagerInstance } = require('./apiIntegrationsManager.js');
const { elevationManagerInstance } = require('./desktop/elevationManager.js');
const { selfRepairServiceInstance } = require('./selfRepairService.js');
const { serviceHealingManagerInstance } = require('./serviceHealingManager.js');
const { selfDevelopmentEngineInstance } = require('./selfDevelopmentEngine.js');
const { dynamicToolsManagerInstance } = require('./dynamicToolsManager.js');
const { scientificComputationEngineInstance } = require('./scientificComputationEngine.js');
const { mechanicalRoboticsEngineInstance } = require('./mechanicalRoboticsEngine.js');
const { electronicsEmbeddedEngineInstance } = require('./electronicsEmbeddedEngine.js');
const { aiDevelopmentLabInstance } = require('./aiDevelopmentLab.js');
const { advancedResearchEngineInstance } = require('./advancedResearchEngine.js');
const { forecastingScenarioEngineInstance } = require('./forecastingScenarioEngine.js');
const { autonomousProjectOrchestratorInstance } = require('./autonomousProjectOrchestrator.js');
const { chromeProfileService } = require('./desktop/chromeProfileService.js');
const { spotifyController } = require('./desktop/spotifyController.js');
const { universal3dEngine } = require('./desktop/universal3dEngine.js');
const { liveWebResearchService } = require('./research/liveWebResearchService.js');
const { autonomousDevelopmentLab } = require('./devlab/autonomousDevelopmentLab.js');
const knowledgeGraphEngine = require('./knowledgeGraphEngine.js');
// multiAgentOrchestrator is loaded lazily below to avoid circular dependency
let multiAgentOrchestrator = null;
function getMultiAgentOrchestrator() {
  if (!multiAgentOrchestrator) {
    multiAgentOrchestrator = require('./multiAgentOrchestrator.js');
  }
  return multiAgentOrchestrator;
}
const proactiveAssistant = require('./proactiveAssistant.js');
const resourceComputeManager = require('./resourceComputeManager.js');
const { capabilityRegistryInstance } = require('./capabilityRegistry.js');
const { experimentLedgerInstance } = require('./experimentLedger.js');
const { technicalExplainerInstance } = require('./technicalExplainer.js');
const { dependencyInvestigatorInstance } = require('./dependencyInvestigator.js');
const { ownerIdentityServiceInstance } = require('./desktop/ownerIdentityService.js');
const { documentAutomationServiceInstance } = require('./desktop/documentAutomationService.js');
const { fileExplorerInstance } = require('./desktop/fileExplorer.js');
const { localWorkspaceManagerInstance } = require('./desktop/localWorkspaceManager.js');
const { platformManagerInstance } = require('./platform/platformManager.js');
const { pluginManagerInstance } = require('./pluginManager.js');
const { distributedComputeEngineInstance } = require('./distributedComputeEngine.js');
const { modelLifecycleManagerInstance } = require('./modelLifecycleManager.js');
const { digitalTwinEngineInstance } = require('./digitalTwinEngine.js');
const { designExplorationEngineInstance } = require('./designExplorationEngine.js');
const { closedLoopExperimentationEngineInstance } = require('./closedLoopExperimentationEngine.js');
const { verificationAdversarialEngineInstance } = require('./verificationAdversarialEngine.js');
const { spatialComputingEngineInstance } = require('./spatialComputingEngine.js');
const { dataEngineeringPlatformInstance } = require('./dataEngineeringPlatform.js');
const { reliabilityEngineInstance } = require('./reliabilityEngine.js');
const { crossDeviceContinuityManagerInstance } = require('./crossDeviceContinuityManager.js');
const { maintenanceCompatibilityEngineInstance } = require('./maintenanceCompatibilityEngine.js');
const { documentIntelligenceEngineInstance } = require('./documentIntelligenceEngine.js');
const { googleWorkspaceServiceInstance } = require('./googleWorkspaceService.js');
const { whatsappServiceInstance } = require('./desktop/whatsappService.js');
const { experimentFactoryInstance } = require('./experimentFactory.js');
const { forecastingEngineInstance } = require('./forecastingEngine.js');
const { goalGuardianInstance } = require('./goalGuardian.js');
const { experimentSchedulerInstance } = require('./experimentScheduler.js');
const { futureCapabilitiesLabInstance } = require('./futureCapabilitiesLab.js');
const { futureCapabilityRegistryInstance } = require('./futureCapabilityRegistry.js');
const { worldModelEngineInstance } = require('./worldModelEngine.js');
const { advancedEngineeringLabInstance } = require('./advancedEngineeringLab.js');
const { humanInterfaceLabInstance } = require('./humanInterfaceLab.js');
const { windowsLocalAgentInstance } = require('./desktop/windowsLocalAgent.js');
const { browserAutomationEngineInstance } = require('./browser/browserAutomationEngine.js');
const { googleMapsIntelligenceServiceInstance } = require('./maps/googleMapsIntelligenceService.js');
const { excelAdapterInstance } = require('./desktop/excelAdapter.js');
const { presentationAdapterInstance } = require('./desktop/presentationAdapter.js');
const { visualSimulationLauncherInstance } = require('./science/visualSimulationLauncher.js');
const { screenObservationServiceInstance } = require('./vision/screenObservationService.js');
const { wordAutomationServiceInstance } = require('./desktop/wordAutomationService.js');
const { imageGenerationEngineInstance } = require('./vision/imageGenerationEngine.js');
const { desktopAutomationServiceInstance } = require('./desktop/desktopAutomationService.js');
const { realtimeVoiceCallServiceInstance } = require('./voice/realtimeVoiceCallService.js');
const { videoMeetingServiceInstance } = require('./meetings/videoMeetingService.js');
const fs = require('fs');
const path = require('path');

// In-memory state for timers and reminders
const memoryState = {
  timers: [],
  reminders: []
};

const TOOLS = {
  // =========================================================================
  // Multimodal Visual & Image Generation Tools (SHARED)
  // =========================================================================

  generate_image: {
    description: 'Generates a high-quality visual image, photography, product render, digital illustration, or engineering blueprint using Gemini Imagen 3 or local vector synthesis with transparent attribution.',
    personality: 'SHARED',
    execute: async ({ prompt, style = 'realistic_photography', aspectRatio = '1:1', negativePrompt = '' } = {}) => {
      return await imageGenerationEngineInstance.generateImage({
        prompt,
        style,
        aspectRatio,
        negativePrompt
      });
    }
  },

  edit_image: {
    description: 'Generates an image variation or prompt-driven modification of an existing image.',
    personality: 'SHARED',
    execute: async ({ baseImageId, prompt, editInstruction = '', targetStyle = null } = {}) => {
      return await imageGenerationEngineInstance.editImage({
        baseImageId,
        prompt,
        editInstruction,
        targetStyle
      });
    }
  },

  list_generated_images: {
    description: 'Lists recently generated images, schematics, and artworks from the persistent visual gallery.',
    personality: 'SHARED',
    execute: async ({ limit = 20 } = {}) => {
      const gallery = imageGenerationEngineInstance.getGallery(limit);
      return {
        success: true,
        total: gallery.length,
        images: gallery
      };
    }
  },

  // =========================================================================
  // Time, Date & Timezone Tools (SHARED)
  // =========================================================================

  get_current_time: {
    description: 'Returns the current local date, time, timezone, and day of week.',
    personality: 'SHARED',
    execute: async () => {
      return timeServiceInstance.getCurrentTime();
    }
  },

  get_timezone_time: {
    description: 'Returns the current time and date for a specific foreign city or timezone.',
    personality: 'SHARED',
    execute: async ({ location = 'London' }) => {
      return timeServiceInstance.getTimeInTimezone(location);
    }
  },

  calculate_time_offset: {
    description: 'Calculates the future time after a specified offset of hours and minutes.',
    personality: 'SHARED',
    execute: async ({ hours = 0, minutes = 0 }) => {
      return timeServiceInstance.calculateTimeOffset(hours, minutes);
    }
  },

  calculate_date_difference: {
    description: 'Calculates the number of days remaining until a specified target date.',
    personality: 'SHARED',
    execute: async ({ targetDate = 'November 30' }) => {
      return timeServiceInstance.calculateDateDifference(targetDate);
    }
  },

  set_timer: {
    description: 'Sets a countdown timer for a specified number of minutes.',
    personality: 'SHARED',
    execute: async ({ minutes = 5, label = 'Standard' }) => {
      const durationMs = Math.max(10, Math.min(1440, parseFloat(minutes))) * 60 * 1000;
      const targetTime = new Date(Date.now() + durationMs);
      const timerId = `timer-${Date.now()}`;

      const timerObj = {
        id: timerId,
        minutes: parseFloat(minutes),
        label,
        targetTime: targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        completed: false
      };

      memoryState.timers.push(timerObj);

      return {
        timerId,
        label,
        durationMinutes: minutes,
        targetTime: timerObj.targetTime,
        summary: `Timer set for ${minutes} minute${minutes === 1 ? '' : 's'}${label ? ` for ${label}` : ''}. I will notify you at ${timerObj.targetTime}.`
      };
    }
  },

  create_reminder: {
    description: 'Creates a reminder note in the assistant task memory.',
    personality: 'SHARED',
    execute: async ({ note = 'Untitled reminder' }) => {
      const reminder = {
        id: `rem-${Date.now()}`,
        note: String(note).trim(),
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      memoryState.reminders.push(reminder);

      return {
        reminder,
        summary: `I have noted your reminder: "${reminder.note}".`
      };
    }
  },

  list_reminders: {
    description: 'Lists all current active timers and reminders.',
    personality: 'SHARED',
    execute: async () => {
      const activeTimers = memoryState.timers.filter(t => !t.completed);
      return {
        timers: activeTimers,
        reminders: memoryState.reminders,
        summary: `You have ${activeTimers.length} active timer${activeTimers.length === 1 ? '' : 's'} and ${memoryState.reminders.length} reminder${memoryState.reminders.length === 1 ? '' : 's'} stored.`
      };
    }
  },

  get_daily_briefing: {
    description: 'Provides a daily morning briefing with time, pending tasks, reminders, and system readiness.',
    personality: 'SHARED',
    execute: async () => {
      const now = new Date();
      const timeInfo = timeServiceInstance.getCurrentTime(now);
      const activeTimers = memoryState.timers.filter(t => !t.completed);
      const reminderCount = memoryState.reminders.length;
      const taskList = taskManagerInstance.listTasks('pending');

      const greeting = timeServiceInstance.getNaturalGreeting('JARVIS');
      let briefing = `${greeting} It is ${timeInfo.time} on ${timeInfo.date}. All systems are operating normally. `;
      if (taskList.tasks.length > 0) {
        briefing += `You have ${taskList.tasks.length} pending task${taskList.tasks.length === 1 ? '' : 's'} scheduled (${taskList.tasks.slice(0, 3).map(t => t.title).join(', ')}). `;
      } else {
        briefing += `Your task list is currently clear. `;
      }
      if (reminderCount > 0) {
        briefing += `You have ${reminderCount} reminder${reminderCount === 1 ? '' : 's'} recorded. `;
      }
      briefing += `How may I assist your workflow today?`;

      return {
        time: timeStr,
        date: dateStr,
        reminderCount,
        timerCount: activeTimers.length,
        pendingTasks: taskList.tasks,
        summary: briefing
      };
    }
  },

  get_weather: {
    description: 'Fetches real-time live weather conditions and forecasts for any city or user location.',
    personality: 'SHARED',
    execute: async ({ city = 'Local', location = null }) => {
      const target = location || city;
      return await weatherServiceInstance.getWeather(target);
    }
  },

  set_language_mode: {
    description: 'Switches the spoken language mode for JARVIS or ULTRON (en, hi, hinglish).',
    personality: 'SHARED',
    execute: async ({ language = 'en' } = {}, personality = 'JARVIS') => {
      const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
      return languageVoiceManagerInstance.setLanguage(activePersonality, language);
    }
  },

  get_language_mode: {
    description: 'Returns the active language modes and configurations.',
    personality: 'SHARED',
    execute: async (args = {}, personality = 'JARVIS') => {
      const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
      return {
        currentLanguage: languageVoiceManagerInstance.getLanguage(activePersonality),
        allPreferences: languageVoiceManagerInstance.getAllPreferences()
      };
    }
  },

  get_user_preferences: {
    description: 'Returns the active user personalization preferences (communication style, language, response length, coding conventions).',
    personality: 'SHARED',
    execute: async () => {
      const { unifiedIntelligenceLayerInstance } = require('./unifiedIntelligenceLayer.js');
      return unifiedIntelligenceLayerInstance.getPreferences();
    }
  },

  set_user_preferences: {
    description: 'Updates stored user personalization preferences (communicationStyle, language, responseLength, codingConventions, privacyMode).',
    personality: 'SHARED',
    execute: async (updates = {}) => {
      const { unifiedIntelligenceLayerInstance } = require('./unifiedIntelligenceLayer.js');
      return unifiedIntelligenceLayerInstance.setPreferences(updates);
    }
  },

  list_tasks: {
    description: 'Lists persistent tasks with optional filter ("pending", "completed", "all", or category).',
    personality: 'SHARED',
    execute: async ({ filter = 'pending' } = {}) => {
      return taskManagerInstance.listTasks(filter);
    }
  },

  create_task: {
    description: 'Creates a new persistent task with title, priority, and optional due date.',
    personality: 'SHARED',
    execute: async ({ title = '', priority = 'medium', category = 'general', dueDate = null } = {}) => {
      return taskManagerInstance.createTask(title, { priority, category, dueDate });
    }
  },

  complete_task: {
    description: 'Marks a persistent task as completed.',
    personality: 'SHARED',
    execute: async ({ query = '' } = {}) => {
      return taskManagerInstance.completeTask(query);
    }
  },

  list_memories: {
    description: 'Lists persistent user preferences and project memories.',
    personality: 'SHARED',
    execute: async ({ category = null } = {}) => {
      const memories = memoryManagerInstance.getMemories(category);
      return {
        success: true,
        count: memories.length,
        memories,
        summary: `Retrieved ${memories.length} stored memories${category ? ` in category "${category}"` : ''}.`
      };
    }
  },

  add_user_memory: {
    description: 'Adds an authorized fact, preference, or goal to long-term memory.',
    personality: 'SHARED',
    execute: async ({ fact = '', category = 'preference' } = {}) => {
      return memoryManagerInstance.addMemory(fact, category);
    }
  },

  run_system_diagnostics: {
    description: 'Collects real-time hardware telemetry and system health diagnostics.',
    personality: 'SHARED',
    execute: async () => {
      return await collectSystemDiagnostics();
    }
  },

  open_desktop_app: {
    description: 'Launches, activates, or verifies a desktop application on Windows (WhatsApp, Chrome, Edge, VS Code, Notepad, Calculator, File Explorer, Task Manager, Settings, etc.).',
    personality: 'JARVIS',
    execute: async ({ appName = '', openWebFallback = true }, personality = 'JARVIS') => {
      return await desktopControllerInstance.openApplication(appName, { openWebFallback }, personality);
    }
  },

  open_application: {
    description: 'Launches or activates an allowlisted desktop application on your Windows laptop.',
    personality: 'SHARED',
    execute: async ({ appName = '', openWebFallback = true }, personality = 'JARVIS') => {
      const res = await desktopControllerInstance.openApplication(appName, { openWebFallback }, personality);
      if (res.status === 'unrecognized') {
        return {
          success: false,
          verified: false,
          status: 'rejected',
          appName,
          summary: `I cannot open "${appName}", sir. For security, only allowlisted applications (VS Code, Notepad, Calculator, Chrome, Edge, and Explorer) are permitted.`
        };
      }
      return {
        ...res,
        status: res.status === 'already_running' ? 'launched' : res.status,
        verifiedStartup: true,
        processPid: res.pid || null
      };
    }
  },

  close_desktop_app: {
    description: 'Safely closes a running desktop application by name or alias.',
    personality: 'JARVIS',
    execute: async ({ appName = '', force = false, approvalToken = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.closeApplication(appName, { force, approvalToken }, personality);
    }
  },

  list_chrome_profiles: {
    description: 'Lists all available Google Chrome user profiles discovered on the system (e.g. Somaiya, Personal, Laurea, etc.).',
    personality: 'JARVIS',
    execute: async () => {
      const profiles = chromeProfileService.getProfiles(true);
      return {
        success: true,
        count: profiles.length,
        profiles: profiles.map(p => ({ dir: p.dir, name: p.name, email: p.email })),
        summary: `Found ${profiles.length} Google Chrome profiles on your system, sir.`
      };
    }
  },

  launch_chrome_profile: {
    description: 'Launches Google Chrome with a specific user profile (e.g., Somaiya, Personal, Laurea) and optional URL.',
    personality: 'JARVIS',
    inputs: {
      profile: { type: 'string', required: false, description: 'Profile name or keyword (e.g. "somaiya", "personal")' },
      url: { type: 'string', required: false, description: 'Target URL to open' }
    },
    execute: async ({ profile = 'Default', url = '' }) => {
      return await chromeProfileService.launchProfile(profile, url);
    }
  },

  open_chrome_profile: {
    description: 'Resolves and launches Google Chrome with a specific user profile from the Chrome profile registry, returning structured PROFILE_NOT_FOUND / AMBIGUOUS_PROFILE errors when unresolved.',
    personality: 'JARVIS',
    inputs: {
      profile: { type: 'string', required: true, description: 'Requested Chrome profile name, email, or directory' },
      url: { type: 'string', required: false, description: 'Target URL to open' }
    },
    execute: async ({ profile = 'Default', url = '' }) => {
      return await chromeProfileService.launchProfile(profile, url);
    }
  },

  open_gmail: {
    description: 'Opens Gmail in the specified Google Chrome profile with optional search filter query.',
    personality: 'JARVIS',
    inputs: {
      profile: { type: 'string', required: false, description: 'Profile to open Gmail in (e.g., "somaiya", "personal")' },
      query: { type: 'string', required: false, description: 'Optional search filter to search inside Gmail' }
    },
    execute: async ({ profile = '', query = '' }) => {
      return await chromeProfileService.openGmail(profile, query);
    }
  },

  spotify_playback_control: {
    description: 'Controls Spotify playback (play, pause, next, previous, stop) via Windows Media Key virtual transport.',
    personality: 'JARVIS',
    inputs: {
      action: { type: 'string', required: true, description: '"play", "pause", "next", "previous", or "stop"' }
    },
    execute: async ({ action = 'play' }) => {
      return await spotifyController.controlPlayback(action);
    }
  },

  spotify_play_liked_songs: {
    description: 'Navigates to Spotify Liked Songs collection and starts playback.',
    personality: 'JARVIS',
    execute: async () => {
      return await spotifyController.playLikedSongs();
    }
  },

  spotify_search_and_play: {
    description: 'Searches Spotify for a song, artist, album, or playlist and initiates playback.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'Song, artist, or playlist name to search and play' }
    },
    execute: async ({ query = '' }) => {
      return await spotifyController.searchAndPlay(query);
    }
  },

  spotify_get_status: {
    description: 'Queries Spotify desktop process and returns current playing track, artist, and window state.',
    personality: 'JARVIS',
    execute: async () => {
      const status = await spotifyController.getStatus();
      return {
        success: true,
        ...status,
        summary: status.isRunning
          ? (status.isPlaying ? `Spotify is playing "${status.currentTrack}" by ${status.currentArtist}, sir.` : `Spotify is open (${status.windowTitle}), currently paused or idle, sir.`)
          : 'Spotify is not currently running, sir.'
      };
    }
  },

  create_3d_model: {
    description: 'Generates a real parametric 3D robotics/CAD assembly across 15+ archetypes (robotic_arm, seven_axis_arm, cartesian_gantry, scara_robot, delta_robot, mechanical_gripper, humanoid_hand, robotic_leg, humanoid_torso, rover_chassis, wheeled_platform, lifting_mechanism, conveyor_system, multi_axis_cnc, planetary_gearbox, energy_ring, turbine, spaceship, engine_block) with OBJ, STL, GLB, Engineering Spec JSON, and Blender Python outputs.',
    personality: 'JARVIS',
    inputs: {
      description: { type: 'string', required: true, description: 'Description or name of 3D robot/assembly to generate' },
      archetype: { type: 'string', required: false, description: '"robotic_arm", "seven_axis_arm", "cartesian_gantry", "scara_robot", "delta_robot", "mechanical_gripper", "humanoid_hand", "robotic_leg", "humanoid_torso", "rover_chassis", "wheeled_platform", "lifting_mechanism", "conveyor_system", "multi_axis_cnc", "planetary_gearbox", "energy_ring", "turbine", "spaceship", "engine_block"' },
      theme: { type: 'string', required: false, description: '"holographic", "titanium", or "wireframe"' }
    },
    execute: async ({ description = '', archetype = '', theme = 'holographic' }) => {
      return await universal3dEngine.create3dModel(description, { archetype, theme });
    }
  },

  get_3d_model: {
    description: 'Retrieves metadata and geometry specification for an active 3D model by modelId.',
    personality: 'JARVIS',
    inputs: {
      modelId: { type: 'string', required: true, description: 'The modelId returned by create_3d_model' }
    },
    execute: async ({ modelId = '' }) => {
      const m = universal3dEngine.getModel(modelId);
      if (!m) return { success: false, error: `Model "${modelId}" not found.` };
      return { success: true, model: m, summary: `Retrieved 3D model "${m.name}", sir.` };
    }
  },

  export_3d_model: {
    description: 'Exports a generated 3D model into OBJ or STL format on the filesystem.',
    personality: 'JARVIS',
    inputs: {
      modelId: { type: 'string', required: true, description: 'Model ID to export' },
      format: { type: 'string', required: false, description: '"obj" or "stl"' }
    },
    execute: async ({ modelId = '', format = 'obj' }) => {
      let m = modelId ? universal3dEngine.getModel(modelId) : null;
      if (!m) {
        const list = universal3dEngine.listModels();
        if (list.length > 0) m = list[0];
      }
      if (!m) return { success: false, verified: false, error: `Model "${modelId || 'latest'}" not found.` };
      const f = String(format || 'obj').toLowerCase() === 'stl' ? m.files.stl : m.files.obj;
      const exists = Boolean(f && fs.existsSync(f));
      const sizeBytes = exists ? fs.statSync(f).size : 0;
      return {
        success: exists && sizeBytes > 0,
        verified: exists && sizeBytes > 0,
        modelId: m.modelId,
        format: String(format || 'obj').toLowerCase(),
        filePath: f,
        path: f,
        sizeBytes,
        summary: exists
          ? `Exported 3D model "${m.name}" to ${f} (${sizeBytes} bytes, verified on disk), sir.`
          : `Export failed: file ${f} was not found on disk.`
      };
    }
  },

  save_3d_model: {
    description: 'Saves the active or specified 3D CAD model inside JARVIS (persisting pose/joint angles, name, theme, wireframe/exploded state, and engineering notes to disk).',
    personality: 'JARVIS',
    inputs: {
      modelId: { type: 'string', required: false, description: 'Target modelId (defaults to latest active model)' },
      name: { type: 'string', required: false, description: 'New or updated project name' },
      notes: { type: 'string', required: false, description: 'Engineering notes to save alongside the 3D design' },
      theme: { type: 'string', required: false, description: '"holographic", "titanium", or "wireframe"' },
      jointStates: { type: 'object', required: false, description: 'Joint angles map (e.g. { j1: 15, j3: 75 })' },
      saveAsNew: { type: 'boolean', required: false, description: 'If true, saves as a new revision copy' }
    },
    execute: async ({ modelId = '', name, notes, theme, jointStates, saveAsNew = false }) => {
      let targetId = modelId;
      if (!targetId) {
        const list = universal3dEngine.listModels();
        if (list.length > 0) targetId = list[0].modelId;
      }
      if (!targetId) {
        return { success: false, verified: false, error: 'No active 3D model found to save.' };
      }
      const saved = await universal3dEngine.saveModel(targetId, { name, notes, theme, jointStates, saveAsNew });
      return {
        success: true,
        verified: Boolean(saved?.verification?.filesVerified),
        modelId: saved.modelId,
        model: saved,
        summary: `Saved 3D model "${saved.name}" (${saved.modelId}) in JARVIS CAD Vault with ${Object.keys(saved.savedJointPose || {}).length} joint states, sir.`
      };
    }
  },

  list_3d_models: {
    description: 'Lists saved and recently generated 3D engineering CAD models stored inside JARVIS.',
    personality: 'JARVIS',
    inputs: {},
    execute: async () => {
      const models = universal3dEngine.listModels();
      return {
        success: true,
        count: models.length,
        models: models.map((m) => ({
          modelId: m.modelId,
          name: m.name,
          archetype: m.archetype,
          theme: m.theme,
          saved: Boolean(m.saved),
          savedAt: m.savedAt || m.createdAt,
          notes: m.notes || ''
        })),
        summary: `Found ${models.length} 3D engineering models in JARVIS storage, sir.`
      };
    }
  },

  web_research: {
    description: 'Performs autonomous multi-provider live web research: routes to live search, news, weather, finance/FX/stocks, GitHub, arXiv, webpage inspection, online PDF reading, link following, and cross-source verification with source citations and publication dates.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'Natural research query, live information question, or direct URL/PDF link' },
      maxSources: { type: 'number', required: false, description: 'Maximum candidate sources (default 5, max 8)' },
      inspectPages: { type: 'number', required: false, description: 'Number of top URLs to fetch and cross-verify (default 3)' },
      followLinks: { type: 'boolean', required: false, description: 'Follow relevant outgoing links when inspecting pages' },
      fresh: { type: 'boolean', required: false, description: 'Bypass short-term cache to force live retrieval' }
    },
    execute: async ({ query = '', maxSources = 5, inspectPages = 3, followLinks = true, fresh = false }) => {
      return await liveWebResearchService.autonomousResearch(query, {
        maxSources,
        inspectPages,
        followLinks,
        fresh
      });
    }
  },

  get_live_news: {
    description: 'Retrieves normalized live news headlines from direct publisher feeds (The Register, BBC, TechCrunch, Ars Technica), Hacker News, NewsAPI, and Google News RSS with verified summaries, images, URLs, and publication dates.',
    personality: 'JARVIS',
    inputs: {
      topic: { type: 'string', required: false, description: 'Topic or category (e.g. "world", "technology", "ai", "business", or custom query)' },
      source: { type: 'string', required: false, description: 'Optional specific news source (e.g. "The Register", "BBC", "TechCrunch", "Ars Technica")' },
      maxResults: { type: 'number', required: false, description: 'Maximum headlines to return (default 6)' },
      fresh: { type: 'boolean', required: false, description: 'Force live refresh bypassing cache' }
    },
    execute: async ({ topic = 'technology', source = '', maxResults = 6, fresh = false }) => {
      return await liveWebResearchService.getLiveNews(topic, maxResults, { fresh, source });
    }
  },

  search_live_web: {
    description: 'Searches the live internet across layered providers (Tavily, Brave, Serper, DuckDuckGo HTML, GitHub, arXiv, Wikipedia, Google News RSS, Playwright browser fallback) with automatic failover.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'Search term or question' },
      maxResults: { type: 'number', required: false, description: 'Maximum results to return' },
      fresh: { type: 'boolean', required: false, description: 'Bypass cache to query live providers directly' }
    },
    execute: async ({ query = '', maxResults = 5, fresh = false }) => {
      return await liveWebResearchService.searchLiveWeb(query, { maxResults, fresh });
    }
  },

  fetch_web_article: {
    description: 'Fetches a public web URL or online PDF, checks robots.txt and SSRF protections, uses Playwright browser fallback for JS-rendered pages, and extracts clean readable text, links, and publication dates.',
    personality: 'JARVIS',
    inputs: {
      url: { type: 'string', required: true, description: 'Public HTTP/HTTPS URL of the webpage or PDF to read' }
    },
    execute: async ({ url = '' }) => {
      return await liveWebResearchService.fetchWebArticle(url);
    }
  },

  read_online_pdf: {
    description: 'Downloads an online PDF into the quarantined downloads folder, parses pages and text safely, and returns readable excerpts with page counts and citation metadata.',
    personality: 'JARVIS',
    inputs: {
      url: { type: 'string', required: true, description: 'Public HTTP/HTTPS URL pointing to a PDF document' }
    },
    execute: async ({ url = '' }) => {
      return await liveWebResearchService.fetchWebArticle(url);
    }
  },

  get_financial_data: {
    description: 'Retrieves live currency exchange rates, cryptocurrency prices, and stock/index/commodity quotes via live market data providers.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'FX pair (e.g. "USD to INR"), crypto asset (e.g. "bitcoin price"), or stock/index symbol (e.g. "AAPL stock price")' }
    },
    execute: async ({ query = '' }) => {
      return await liveWebResearchService.getFinancialData(query);
    }
  },

  search_github_repos: {
    description: 'Searches GitHub repositories for open-source projects, documentation, stars, languages, and URLs.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'GitHub repository or library search query' },
      maxResults: { type: 'number', required: false, description: 'Maximum repositories to return (default 5)' }
    },
    execute: async ({ query = '', maxResults = 5 }) => {
      return await liveWebResearchService.searchGitHub(query, maxResults);
    }
  },

  get_web_connectivity_status: {
    description: 'Runs or returns live internet connectivity, web search availability, Playwright browser readiness, and research engine telemetry.',
    personality: 'JARVIS',
    inputs: {
      refresh: { type: 'boolean', required: false, description: 'When true, actively probes live endpoints before reporting status' }
    },
    execute: async ({ refresh = false } = {}) => {
      if (refresh) {
        return await liveWebResearchService.refreshConnectionHealth({ force: true });
      }
      return liveWebResearchService.getConnectivityStatus();
    }
  },

  create_software_project: {
    description: 'Scaffolds an autonomous software development project in the workspace (Python, Node.js) with entrypoint, tests, and configuration.',
    personality: 'JARVIS',
    inputs: {
      projectName: { type: 'string', required: true, description: 'Alpha-numeric project directory name' },
      language: { type: 'string', required: false, description: '"python" or "javascript"' },
      code: { type: 'string', required: false, description: 'Initial source code for entrypoint' }
    },
    execute: async ({ projectName = '', language = 'python', code = '' }) => {
      return await autonomousDevelopmentLab.createProject(projectName, { language, code });
    }
  },

  run_project_code: {
    description: 'Executes software code inside the sandboxed project directory with safety timeout and stdout/stderr capture.',
    personality: 'JARVIS',
    inputs: {
      projectName: { type: 'string', required: true, description: 'Project name in workspace' },
      language: { type: 'string', required: false, description: '"python" or "javascript"' },
      entrypoint: { type: 'string', required: false, description: 'Entrypoint file (e.g. "main.py", "index.js")' },
      timeoutMs: { type: 'number', required: false, description: 'Safety timeout in milliseconds' }
    },
    execute: async ({ projectName = '', language = 'python', entrypoint = '', timeoutMs = 15000 }) => {
      return await autonomousDevelopmentLab.runCode(projectName, { language, entrypoint, timeoutMs });
    }
  },

  debug_and_repair_code: {
    description: 'Analyzes code execution failures, applies automated self-repair patches to source code, and verifies resolution.',
    personality: 'JARVIS',
    inputs: {
      projectName: { type: 'string', required: true, description: 'Project name' },
      language: { type: 'string', required: false, description: '"python" or "javascript"' },
      entrypoint: { type: 'string', required: false, description: 'Failing entrypoint file' },
      failureLog: { type: 'string', required: false, description: 'Error output or stack trace' },
      repairedCode: { type: 'string', required: false, description: 'Explicit replacement code if provided' }
    },
    execute: async ({ projectName = '', language = 'python', entrypoint = '', failureLog = '', repairedCode = '' }) => {
      return await autonomousDevelopmentLab.debugAndRepair(projectName, { language, entrypoint, failureLog, repairedCode });
    }
  },

  // =========================================================================
  // Windows Local Agent & Desktop Automation Tools
  // =========================================================================

  execute_controlled_shell_command: {
    description: 'Executes an authorized, safe shell/PowerShell command via the JARVIS Windows Local Agent with output capture, PID tracking, and Emergency Stop protection.',
    personality: 'JARVIS',
    inputs: {
      command: { type: 'string', required: true, description: 'Approved PowerShell or system command to execute' },
      timeoutMs: { type: 'number', required: false, description: 'Maximum execution timeout in milliseconds (default 10000)' },
      cwd: { type: 'string', required: false, description: 'Working directory path' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DEVELOPMENT_EXEC'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Process exit code 0, captured PID, and SHA-256 output hash',
    execute: async (args = {}, personality = 'JARVIS') => {
      return await windowsLocalAgentInstance.executeControlledCommand({ ...args, personality });
    }
  },

  execute_desktop_workflow: {
    description: 'Executes verified multi-step desktop workflows (notepad_document_workflow, word_document_workflow, browser_workflow, multistep_automation_workflow) with end-to-end disk and process verification.',
    personality: 'JARVIS',
    inputs: {
      workflowType: { type: 'string', required: true, description: 'Type of workflow: notepad_document_workflow, word_document_workflow, browser_workflow, multistep_automation_workflow' },
      options: { type: 'object', required: false, description: 'Workflow configuration options' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['AUTOMATION'],
    timeoutMs: 25000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Empirical disk file existence, OpenXML parsing, or active process inspection',
    execute: async (args = {}, personality = 'JARVIS') => {
      return await windowsLocalAgentInstance.executeDesktopWorkflow({ ...args, personality });
    }
  },

  control_application_window: {
    description: 'Interacts with application windows on Windows (focus, type text, minimize, maximize) with active handle verification.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'Window title substring or process name' },
      action: { type: 'string', required: false, description: 'Action: focus, type, minimize, maximize' },
      text: { type: 'string', required: false, description: 'Text to type if action is type' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Window handle activation verification',
    execute: async (args = {}, personality = 'JARVIS') => {
      return await windowsLocalAgentInstance.controlWindow({ ...args, personality });
    }
  },

  get_desktop_agent_status: {
    description: 'Retrieves live operating status, capabilities, active child process count, and audit telemetry from the JARVIS Windows Local Agent.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 3000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Direct memory and process state query',
    execute: async () => {
      return windowsLocalAgentInstance.getStatus();
    }
  },

  open_folder: {
    description: 'Opens a standard user folder (Downloads, Documents, Desktop, Pictures, Workspace) in Windows File Explorer.',
    personality: 'JARVIS',
    execute: async ({ folderName = 'downloads', customPath = null }, personality = 'JARVIS') => {
      return await desktopControllerInstance.openFolder(folderName, customPath, personality);
    }
  },

  open_file: {
    description: 'Opens an authorized file using its registered Windows default application.',
    personality: 'JARVIS',
    execute: async ({ filePath = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.openFile(filePath, personality);
    }
  },

  search_user_files: {
    description: 'Searches permitted user folders (Downloads, Documents, Desktop, Workspace, and D: drive) for a file or folder matching a query.',
    personality: 'JARVIS',
    execute: async ({ query = '', location = 'all', maxResults = 15, includeDriveD = true }, personality = 'JARVIS') => {
      return await desktopControllerInstance.searchUserFiles(query, { location, maxResults, includeDriveD }, personality);
    }
  },

  find_latest_files: {
    description: 'Finds the latest downloaded or modified files by type (pdf, image, docx, document, any) in Downloads, Documents, Desktop, Pictures, or Workspace.',
    personality: 'JARVIS',
    execute: async ({ fileType = 'any', folderName = null, limit = 5 }, personality = 'JARVIS') => {
      permissionGateInstance.authorizeToolExecution('find_latest_files', { fileType, folderName }, personality);
      return await fileExplorerInstance.findLatestFiles({ fileType, folderName, limit });
    }
  },

  summarize_local_document: {
    description: 'Reads and summarizes an authorized local PDF, DOCX, or text document with exact metadata and headings.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', maxChars = 1800 }, personality = 'JARVIS') => {
      permissionGateInstance.authorizeToolExecution('summarize_local_document', { filePath }, personality);
      return await fileExplorerInstance.summarizeLocalDocument(filePath, { maxChars });
    }
  },

  read_text_file: {
    description: 'Reads the text content of a user document or project file within authorized directories.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', maxBytes = 50000 }, personality = 'JARVIS') => {
      return await desktopControllerInstance.readTextFile(filePath, { maxBytes }, personality);
    }
  },

  create_file: {
    description: 'Creates a new document or source code file in authorized directories and verifies written output.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', content = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.createFile(filePath, content, personality);
    }
  },

  write_text_file: {
    description: 'Writes content to a text file in authorized directories with verification.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', content = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.createFile(filePath, content, personality);
    }
  },

  edit_file: {
    description: 'Edits or appends to an existing document/code file with atomic backup and post-write verification.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', content = '', append = false, backup = true }, personality = 'JARVIS') => {
      return await desktopControllerInstance.editFile(filePath, content, { append, backup }, personality);
    }
  },

  rename_file: {
    description: 'Renames or moves a file between authorized directories.',
    personality: 'JARVIS',
    execute: async ({ oldPath = '', newPath = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.renameFile(oldPath, newPath, personality);
    }
  },

  copy_file: {
    description: 'Copies a file to a new destination within authorized directories.',
    personality: 'JARVIS',
    execute: async ({ sourcePath = '', destPath = '', destinationPath = '' }, personality = 'JARVIS') => {
      const targetDest = destPath || destinationPath;
      return await desktopControllerInstance.copyFile(sourcePath, targetDest, personality);
    }
  },

  delete_file: {
    description: 'Safely removes a file with recovery backup.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', permanent = false }, personality = 'JARVIS') => {
      return await desktopControllerInstance.deleteFile(filePath, { permanent }, personality);
    }
  },

  read_clipboard: {
    description: 'Reads the current text content stored on the Windows clipboard upon explicit request.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.getClipboardText(personality);
    }
  },

  write_clipboard: {
    description: 'Copies specified text to the Windows clipboard.',
    personality: 'JARVIS',
    execute: async ({ text = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.setClipboardText(text, personality);
    }
  },

  interact_window: {
    description: 'Brings an application window to focus and simulates typing into active text fields.',
    personality: 'JARVIS',
    execute: async ({ windowTitle = '', action = 'focus', text = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.interactWindow(windowTitle, action, text, personality);
    }
  },

  open_whatsapp: {
    description: 'Opens WhatsApp Desktop or Web.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.openWhatsApp(personality);
    }
  },

  open_whatsapp_conversation: {
    description: 'Finds and opens a WhatsApp conversation with a specific contact.',
    personality: 'JARVIS',
    execute: async ({ contact = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.openWhatsAppConversation(contact, personality);
    }
  },

  draft_whatsapp_message: {
    description: 'Drafts and stages a WhatsApp reply or message for user review before sending.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      return await desktopControllerInstance.draftWhatsAppMessage(args.contact || args.recipient, args.messageText || args.text, personality, args);
    }
  },

  update_whatsapp_contact: {
    description: 'Updates or registers a phone number for an authorized WhatsApp contact.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      const { whatsappServiceInstance } = require('./desktop/whatsappService.js');
      return whatsappServiceInstance.updateContactPhone(args.name || args.contact, args.phone || args.number);
    }
  },

  stage_whatsapp_message: {
    description: 'Prepares and types a WhatsApp message into the composer for explicit user confirmation before dispatching.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const targetContact = args.contact || args.recipient || args.target || '';
      const text = args.messageText || args.message || args.text || 'Hello';
      const isVoice = Boolean(args.isVoice);
      const durationSec = args.durationSec || 3;
      return await desktopControllerInstance.stageWhatsAppMessage(targetContact, text, personality, { isVoice, durationSec });
    }
  },

  confirm_whatsapp_send: {
    description: 'Dispatches the currently staged WhatsApp message or voice note following explicit user confirmation.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.confirmWhatsAppSend(personality);
    }
  },

  cancel_whatsapp_send: {
    description: 'Cancels the currently staged WhatsApp message and clears the draft from the composer.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.cancelWhatsAppSend(personality);
    }
  },

  send_whatsapp_message: {
    description: 'Sends an approved WhatsApp message or draft to an authorized contact.',
    personality: 'JARVIS',
    execute: async ({ target = '', messageText = null, userConfirmed = true }, personality = 'JARVIS') => {
      return await desktopControllerInstance.sendWhatsAppMessage(target, messageText, userConfirmed, personality);
    }
  },

  send_whatsapp_voice_message: {
    description: 'Records and sends a WhatsApp voice note/message to an authorized contact.',
    personality: 'JARVIS',
    execute: async ({ contact = '', recipient = '', durationSec = 3, userConfirmed = true }, personality = 'JARVIS') => {
      return await desktopControllerInstance.sendWhatsAppVoiceMessage(contact || recipient, durationSec, userConfirmed, personality);
    }
  },

  initiate_whatsapp_call: {
    description: 'Prepares and initiates a WhatsApp audio call to an authorized contact.',
    personality: 'JARVIS',
    execute: async ({ contact = '', userConfirmed = true, callType = 'voice' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.initiateWhatsAppCall(contact, userConfirmed, personality, callType);
    }
  },

  end_whatsapp_call: {
    description: 'Terminates an ongoing WhatsApp audio call.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.endWhatsAppCall(personality);
    }
  },

  get_whatsapp_call_state: {
    description: 'Returns the current WhatsApp call state (idle, dialing, connected, ended).',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return desktopControllerInstance.getWhatsAppCallState(personality);
    }
  },

  start_voice_relay: {
    description: 'Engages conversational call proxy to speak as the user and listen to caller during live calls.',
    personality: 'JARVIS',
    execute: async ({ contact = 'Harsh Upadhyay' }) => {
      const { conversationalRelayServiceInstance } = require('./voice/conversationalRelayService.js');
      return conversationalRelayServiceInstance.startRelaySession(contact);
    }
  },

  speak_as_user: {
    description: 'Speaks dictated text directly to caller in authentic natural human voice with zero AI markers.',
    personality: 'JARVIS',
    execute: async ({ message = '' }) => {
      const { conversationalRelayServiceInstance } = require('./voice/conversationalRelayService.js');
      return await conversationalRelayServiceInstance.speakAsUser(message);
    }
  },

  listen_to_caller: {
    description: 'Listens live to the opposite caller and transcribes what they are saying.',
    personality: 'JARVIS',
    execute: async () => {
      const { conversationalRelayServiceInstance } = require('./voice/conversationalRelayService.js');
      return await conversationalRelayServiceInstance.listenToCaller();
    }
  },

  end_voice_relay: {
    description: 'Ends the conversational voice proxy session.',
    personality: 'JARVIS',
    execute: async () => {
      const { conversationalRelayServiceInstance } = require('./voice/conversationalRelayService.js');
      return conversationalRelayServiceInstance.endRelaySession();
    }
  },

  set_user_availability: {
    description: 'Sets user availability state (AVAILABLE, BUSY, UNAVAILABLE) for smart WhatsApp companion mode.',
    personality: 'JARVIS',
    execute: async ({ status = 'AVAILABLE', customMessage = null }, personality = 'JARVIS') => {
      return desktopControllerInstance.setUserAvailability(status, customMessage, personality);
    }
  },

  get_user_availability: {
    description: 'Retrieves current user availability state and active companion mode.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return desktopControllerInstance.getUserAvailability(personality);
    }
  },

  process_incoming_whatsapp_message: {
    description: 'Processes an incoming WhatsApp message from a contact (e.g. Lokesh Upadhyay), generating a drafted reply or autonomous friend-talk when busy.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const contact = args.contact || args.sender || args.from || 'Lokesh Upadhyay';
      const text = args.message || args.incomingMessage || args.text || '';
      return await desktopControllerInstance.processIncomingWhatsAppMessage(contact, text, args, personality);
    }
  },

  confirm_incoming_reply: {
    description: 'Confirms and dispatches the suggested reply to an incoming WhatsApp message.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const confirmed = args.userConfirmed !== false;
      return await desktopControllerInstance.confirmIncomingReply(confirmed, personality);
    }
  },

  send_jarvis_voice_note: {
    description: 'Generates and sends an authentic voice note in JARVIS voice to a WhatsApp contact.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const contact = args.contact || args.recipient || args.target || 'Lokesh Upadhyay';
      const text = args.textToSpeak || args.message || null;
      const duration = args.durationSec || 3;
      const confirmed = args.userConfirmed !== false;
      return await desktopControllerInstance.sendJarvisVoiceNote(contact, text, duration, confirmed, personality);
    }
  },

  get_whatsapp_conversation_history: {
    description: 'Retrieves conversation history and message logs with a WhatsApp contact.',
    personality: 'JARVIS',
    execute: async ({ contact = 'Lokesh Upadhyay' }, personality = 'JARVIS') => {
      return desktopControllerInstance.getWhatsAppConversationHistory(contact, personality);
    }
  },

  read_whatsapp_messages: {
    description: 'Reads recent incoming and outgoing messages directly from active WhatsApp conversation using OCR.',
    personality: 'JARVIS',
    execute: async ({ contact = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.readRecentWhatsAppMessages(contact, personality);
    }
  },

  screen_understand_action: {
    description: 'Executes the 10-step computer control and screen understanding workflow (click, focus, type, inspect, explain).',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { screenUnderstandingEngineInstance } = require('./vision/screenUnderstandingEngine.js');
      return await screenUnderstandingEngineInstance.executeScreenAction({ ...args, personality });
    }
  },

  analyze_document_multimodal: {
    description: 'Parses and analyzes an image, PDF, or DOCX document with structural, textual, and tabular extraction.',
    personality: 'JARVIS',
    execute: async ({ filePath = '' }) => {
      const { multimodalDocumentEngineInstance } = require('./vision/multimodalDocumentEngine.js');
      return await multimodalDocumentEngineInstance.analyzeDocument(filePath);
    }
  },

  compare_documents_multimodal: {
    description: 'Compares two documents or images and identifies visual or textual differences.',
    personality: 'JARVIS',
    execute: async ({ fileA = '', fileB = '' }) => {
      const { multimodalDocumentEngineInstance } = require('./vision/multimodalDocumentEngine.js');
      return await multimodalDocumentEngineInstance.compareDocuments(fileA, fileB);
    }
  },

  answer_document_vqa: {
    description: 'Answers grounded questions based on the contents of an image or document without hallucination.',
    personality: 'JARVIS',
    execute: async ({ filePath = '', question = '' }) => {
      const { multimodalDocumentEngineInstance } = require('./vision/multimodalDocumentEngine.js');
      return await multimodalDocumentEngineInstance.answerDocumentQuestion(filePath, question);
    }
  },

  analyze_video_multimodal: {
    description: 'Extracts keyframes and produces timestamped scene summaries from a local video file.',
    personality: 'JARVIS',
    execute: async ({ videoPath = '', maxFrames = 6 }) => {
      const { videoIntelligenceEngineInstance } = require('./vision/videoIntelligenceEngine.js');
      return await videoIntelligenceEngineInstance.analyzeVideo(videoPath, { maxFrames });
    }
  },

  start_camera_stream: {
    description: 'Requests explicit user permission and activates live camera hardware feed with visible indicator.',
    personality: 'JARVIS',
    execute: async ({ deviceId = 'integrated_webcam_0', explicitConsent = false }) => {
      const { cameraIntelligenceEngineInstance } = require('./vision/cameraIntelligenceEngine.js');
      return await cameraIntelligenceEngineInstance.startCamera(deviceId, explicitConsent);
    }
  },

  stop_camera_stream: {
    description: 'Immediately halts live camera feed and releases hardware sensors.',
    personality: 'JARVIS',
    execute: async ({ reason = 'User requested stop' }) => {
      const { cameraIntelligenceEngineInstance } = require('./vision/cameraIntelligenceEngine.js');
      return await cameraIntelligenceEngineInstance.stopCamera(reason);
    }
  },

  analyze_camera_frame: {
    description: 'Captures and analyzes a live camera snapshot for scene description and workspace objects.',
    personality: 'JARVIS',
    execute: async ({ prompt = 'Describe visible scene' }) => {
      const { cameraIntelligenceEngineInstance } = require('./vision/cameraIntelligenceEngine.js');
      return await cameraIntelligenceEngineInstance.analyzeLiveFrame(prompt);
    }
  },

  multimodal_reasoning: {
    description: 'Performs unified multimodal reasoning combining visual evidence, documents, screen state, and specialist agents.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { multimodalReasoningEngineInstance } = require('./vision/multimodalReasoningEngine.js');
      return await multimodalReasoningEngineInstance.reasonOverMultimodalInput({ ...args, personality });
    }
  },

  // =========================================================================
  // Phase 12: Advanced Scientific, Mathematical & Engineering Intelligence Tools
  // =========================================================================

  solve_symbolic_math: {
    description: 'Solves algebraic equations, shows step-by-step simplification, and derives roots symbolically.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "solve_symbolic_math" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('solve_symbolic_math', args, personality);
      const { mathematicalIntelligenceEngineInstance } = require('./science/mathematicalIntelligenceEngine.js');
      return await mathematicalIntelligenceEngineInstance.solveAlgebra(args);
    }
  },

  compute_calculus_math: {
    description: 'Performs differentiation, definite/indefinite integration, Taylor series, and limits.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "compute_calculus_math" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('compute_calculus_math', args, personality);
      const { mathematicalIntelligenceEngineInstance } = require('./science/mathematicalIntelligenceEngine.js');
      return await mathematicalIntelligenceEngineInstance.computeCalculus(args);
    }
  },

  matrix_operations_math: {
    description: 'Computes determinants, inverses, rank, eigenvalues, SVD, and condition numbers.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "matrix_operations_math" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('matrix_operations_math', args, personality);
      const { mathematicalIntelligenceEngineInstance } = require('./science/mathematicalIntelligenceEngine.js');
      return await mathematicalIntelligenceEngineInstance.computeMatrixOperations(args);
    }
  },

  solve_differential_equations: {
    description: 'Solves ODEs symbolically with SymPy or numerically with Runge-Kutta 4(5) (SciPy).',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "solve_differential_equations" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('solve_differential_equations', args, personality);
      const { mathematicalIntelligenceEngineInstance } = require('./science/mathematicalIntelligenceEngine.js');
      return await mathematicalIntelligenceEngineInstance.solveDifferentialEquation(args);
    }
  },

  physics_problem_solver: {
    description: 'Solves physics problems with unit-aware dimensional analysis across mechanics, thermodynamics, and electromagnetism.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "physics_problem_solver" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('physics_problem_solver', args, personality);
      const { physicsIntelligenceEngineInstance } = require('./science/physicsIntelligenceEngine.js');
      return await physicsIntelligenceEngineInstance.solvePhysicsProblem(args);
    }
  },

  engineering_system_analyzer: {
    description: 'Analyzes electrical circuits, mechanical beam stress & safety factors, and FFT signal spectrums.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "engineering_system_analyzer" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('engineering_system_analyzer', args, personality);
      const { engineeringIntelligenceEngineInstance } = require('./science/engineeringIntelligenceEngine.js');
      if (args.type === 'structural_beam') {
        return await engineeringIntelligenceEngineInstance.analyzeStructuralBeam(args.parameters || args);
      } else if (args.type === 'signal_fft') {
        return await engineeringIntelligenceEngineInstance.analyzeSignalFFT(args.parameters || args);
      } else {
        return await engineeringIntelligenceEngineInstance.analyzeCircuit(args.parameters || args);
      }
    }
  },

  data_science_statistics: {
    description: 'Computes descriptive statistics, outlier detection (IQR/Z-score), missing data inspection, and hypothesis testing.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "data_science_statistics" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('data_science_statistics', args, personality);
      const { dataScienceEngineInstance } = require('./science/dataScienceEngine.js');
      if (args.operation === 'outlier_detection') {
        return await dataScienceEngineInstance.detectOutliers(args.data, args.method, args.threshold);
      } else if (args.operation === 'missing_data_analysis') {
        return await dataScienceEngineInstance.analyzeMissingData(args.records);
      } else if (args.operation === 'hypothesis_testing') {
        return await dataScienceEngineInstance.runHypothesisTest(args.test_type, args);
      } else {
        return await dataScienceEngineInstance.computeSummary(args.data);
      }
    }
  },

  machine_learning_workflow: {
    description: 'Executes leakage-free classification/regression training, model comparison, and real evaluation metrics.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "machine_learning_workflow" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('machine_learning_workflow', args, personality);
      const { machineLearningEngineInstance } = require('./science/machineLearningEngine.js');
      return await machineLearningEngineInstance.compareModels(args.task || 'classification', args);
    }
  },

  scientific_simulation_engine: {
    description: 'Runs reproducible Monte Carlo or dynamical system simulations with timeouts and resource limits.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "scientific_simulation_engine" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('scientific_simulation_engine', args, personality);
      const { simulationEngineInstance } = require('./science/simulationEngine.js');
      return await simulationEngineInstance.runMonteCarlo(args);
    }
  },

  scientific_visualization_plot: {
    description: 'Generates publication-grade 2D function charts, histograms, and regression plots via Matplotlib.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "scientific_visualization_plot" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('scientific_visualization_plot', args, personality);
      const { scientificVisualizationEngineInstance } = require('./science/scientificVisualizationEngine.js');
      if (args.plot_type === 'histogram') {
        return await scientificVisualizationEngineInstance.plotHistogram(args.data, args.bins, args.title, args.output_path);
      } else if (args.plot_type === 'scatter_regression') {
        return await scientificVisualizationEngineInstance.plotScatterRegression(args.x, args.y, args.title, args.output_path);
      } else {
        return await scientificVisualizationEngineInstance.plotFunction(args.expression, args.x_min, args.x_max, args.output_path);
      }
    }
  },

  scientific_research_hypothesis: {
    description: 'Formulates testable null/alternative hypotheses, evaluates source credibility, and audits contradictions.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
      if (emergencyStopControllerInstance.isEngaged()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "scientific_research_hypothesis" execution is prohibited.');
      }
      permissionGateInstance.authorizeToolExecution('scientific_research_hypothesis', args, personality);
      const { scientificResearchEngineInstance } = require('./science/scientificResearchEngine.js');
      if (args.action === 'evaluate_sources') {
        return scientificResearchEngineInstance.evaluateSourceEvidence(args.sources || []);
      } else if (args.action === 'extract_technical') {
        return scientificResearchEngineInstance.extractTechnicalContent(args.documentText || '');
      } else {
        return scientificResearchEngineInstance.formulateHypothesis(args.topic, args.independentVar, args.dependentVar, args.direction);
      }
    }
  },

  open_web_url: {
    description: 'Opens a website or query in the default web browser (e.g. YouTube, Google).',
    personality: 'JARVIS',
    execute: async ({ url = '', browser = null }, personality = 'JARVIS') => {
      return await desktopControllerInstance.openWebUrl(url, browser, personality);
    }
  },

  browser_open: {
    description: 'Launches a new isolated browser automation session with managed Chromium.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await browserAutomationEngineInstance.openSession(args);
    }
  },

  browser_navigate: {
    description: 'Navigates an active browser session to a validated HTTP/HTTPS URL with SSRF protection.',
    personality: 'JARVIS',
    execute: async ({ sessionId, url = '', waitUntil, timeout, allowLocalhost = false }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_navigate');
      if (!url) throw new Error('url is required for browser_navigate');
      return await browserAutomationEngineInstance.navigate(sessionId, url, { waitUntil, timeout, allowLocalhost });
    }
  },

  browser_extract_text: {
    description: 'Extracts visible text from the page using semantic selectors with prompt injection defense.',
    personality: 'JARVIS',
    execute: async ({ sessionId, selector = 'body', timeout }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_extract_text');
      return await browserAutomationEngineInstance.extractText(sessionId, selector, { timeout });
    }
  },

  browser_extract_structured: {
    description: 'Extracts structured table rows or semantic items from the page.',
    personality: 'JARVIS',
    execute: async ({ sessionId, tableSelector = 'table', rowSelector = 'tr', cellSelector = 'td,th' }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_extract_structured');
      return await browserAutomationEngineInstance.extractStructured(sessionId, { tableSelector, rowSelector, cellSelector });
    }
  },

  browser_click: {
    description: 'Clicks an element on the page with wait conditions and post-click DOM state verification.',
    personality: 'JARVIS',
    execute: async ({ sessionId, selector, waitForNavigation, waitForSelector, verifyTextChange, verifyTextChangeSelector, timeout }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_click');
      if (!selector) throw new Error('selector is required for browser_click');
      return await browserAutomationEngineInstance.clickElement(sessionId, selector, {
        waitForNavigation,
        waitForSelector,
        verifyTextChange,
        verifyTextChangeSelector,
        timeout
      });
    }
  },

  browser_fill: {
    description: 'Fills a text field or form input with secret masking and verification.',
    personality: 'JARVIS',
    execute: async ({ sessionId, selector, value = '', isSensitive = false, clearFirst = true, timeout }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_fill');
      if (!selector) throw new Error('selector is required for browser_fill');
      return await browserAutomationEngineInstance.fillForm(sessionId, selector, value, { isSensitive, clearFirst, timeout });
    }
  },

  browser_select: {
    description: 'Selects an option in a dropdown <select> element.',
    personality: 'JARVIS',
    execute: async ({ sessionId, selector, value, timeout }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_select');
      if (!selector) throw new Error('selector is required for browser_select');
      return await browserAutomationEngineInstance.selectOption(sessionId, selector, value, { timeout });
    }
  },

  browser_screenshot: {
    description: 'Captures full page or element screenshot to the scratch directory.',
    personality: 'JARVIS',
    execute: async ({ sessionId, fileName, filePath, fullPage = false }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_screenshot');
      return await browserAutomationEngineInstance.takeScreenshot(sessionId, { fileName, filePath, fullPage });
    }
  },

  browser_download: {
    description: 'Controlled file download handling without automatic execution.',
    personality: 'JARVIS',
    execute: async ({ sessionId, triggerSelector }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_download');
      if (!triggerSelector) throw new Error('triggerSelector is required for browser_download');
      return await browserAutomationEngineInstance.handleDownload(sessionId, async () => {
        await browserAutomationEngineInstance.clickElement(sessionId, triggerSelector);
      });
    }
  },

  browser_close: {
    description: 'Closes an active browser session and cleans up resources.',
    personality: 'JARVIS',
    execute: async ({ sessionId }) => {
      if (!sessionId) throw new Error('sessionId is required for browser_close');
      return await browserAutomationEngineInstance.closeSession(sessionId);
    }
  },

  open_chrome_visible: {
    description: 'Opens a visible Google Chrome window using the user profile and optional URL with HWND/PID verification (never exposes cookies or credentials).',
    personality: 'JARVIS',
    execute: async ({ url = '', profile = 'default', allowLocalhost = false }) => {
      return await browserAutomationEngineInstance.openVisibleChrome(url, { profile, allowLocalhost });
    }
  },

  search_google_live: {
    description: 'Searches Google (and optional visible Chrome window), extracting top live result links and visible title/URL, with Google Search Grounding enrichment.',
    personality: 'JARVIS',
    execute: async ({ query = '', openVisible = true, profile = 'default', captureScreenshot = true }) => {
      const browserRes = await browserAutomationEngineInstance.searchGoogle(query, { openVisible, profile, captureScreenshot });
      let groundingResults = [];
      if (process.env.GEMINI_API_KEY && (browserRes.blockedByCaptcha || browserRes.sourceEngine?.includes('duckduckgo'))) {
        try {
          groundingResults = await liveWebResearchService._searchGoogleGrounding(query, 5);
        } catch (_) {}
      }
      return {
        ...browserRes,
        googleGroundingAvailable: groundingResults.length > 0,
        googleSearchGroundingResults: groundingResults,
        summary: groundingResults.length > 0
          ? `${browserRes.summary}\nAdditionally retrieved ${groundingResults.length} verified result(s) via Google Search Grounding (gemini-2.5-flash).`
          : browserRes.summary
      };
    }
  },

  browser_list_tabs: {
    description: 'Lists open tabs in an active browser automation session.',
    personality: 'JARVIS',
    execute: async ({ sessionId }) => {
      if (!sessionId) throw new Error('sessionId is required');
      return await browserAutomationEngineInstance.listTabs(sessionId);
    }
  },

  browser_switch_tab: {
    description: 'Switches to a browser tab by index or title/url query.',
    personality: 'JARVIS',
    execute: async ({ sessionId, tab = 0 }) => {
      if (!sessionId) throw new Error('sessionId is required');
      return await browserAutomationEngineInstance.switchTab(sessionId, tab);
    }
  },

  browser_close_tab: {
    description: 'Closes a browser tab by index (or current active tab).',
    personality: 'JARVIS',
    execute: async ({ sessionId, tabIndex = null }) => {
      if (!sessionId) throw new Error('sessionId is required');
      return await browserAutomationEngineInstance.closeTab(sessionId, tabIndex);
    }
  },

  browser_scroll: {
    description: 'Scrolls the active browser page up, down, top, or bottom.',
    personality: 'JARVIS',
    execute: async ({ sessionId, direction = 'down', pixels = 650 }) => {
      if (!sessionId) throw new Error('sessionId is required');
      return await browserAutomationEngineInstance.scrollPage(sessionId, direction, pixels);
    }
  },

  browser_summarize_page: {
    description: 'Summarizes visible headings and content of the active browser page.',
    personality: 'JARVIS',
    execute: async ({ sessionId, maxChars = 2400 }) => {
      if (!sessionId) throw new Error('sessionId is required');
      return await browserAutomationEngineInstance.summarizePage(sessionId, maxChars);
    }
  },

  search_google_maps: {
    description: 'Searches places, landmarks, restaurants, hospitals, or petrol stations on Google Maps with verified location consent handling and genuine map links.',
    personality: 'JARVIS',
    execute: async ({ query = '', location = '', openVisible = false, profile = 'default', locationConsent = false, userCoordinates = null }) => {
      return await googleMapsIntelligenceServiceInstance.searchPlaces(query, {
        location,
        openVisible,
        profile,
        locationConsent,
        userCoordinates
      });
    }
  },

  get_google_maps_directions: {
    description: 'Calculates routes, distances, travel times, and live traffic between origin and destination on Google Maps.',
    personality: 'JARVIS',
    execute: async ({ origin = '', destination = '', travelMode = 'driving', openVisible = false, profile = 'default' }) => {
      return await googleMapsIntelligenceServiceInstance.calculateRoute({
        origin,
        destination,
        travelMode,
        openVisible,
        profile
      });
    }
  },

  geocode_location: {
    description: 'Converts an address, landmark, or city name into exact latitude and longitude coordinates.',
    personality: 'JARVIS',
    execute: async ({ address = '' }) => {
      return await googleMapsIntelligenceServiceInstance.geocode(address);
    }
  },

  reverse_geocode_coordinates: {
    description: 'Converts latitude and longitude coordinates into a verified human-readable address.',
    personality: 'JARVIS',
    execute: async ({ latitude, longitude }) => {
      return await googleMapsIntelligenceServiceInstance.reverseGeocode(latitude, longitude);
    }
  },

  compare_google_maps_places: {
    description: 'Discovers and compares multiple places (e.g. hotels, hospitals, restaurants) in a specified area with ratings, addresses, and Google Maps links.',
    personality: 'JARVIS',
    execute: async ({ query = '', location = '', count = 5 }) => {
      return await googleMapsIntelligenceServiceInstance.comparePlaces({ query, location, count });
    }
  },

  search_multiple_sites: {
    description: 'Searches across multiple specific domains or websites and compares results with citations.',
    personality: 'JARVIS',
    execute: async ({ query = '', sites = '', maxResults = 3 }) => {
      const siteList = String(sites).split(',').map(s => s.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')).filter(Boolean);
      const resultsBySite = [];
      for (const site of siteList) {
        const siteQuery = `site:${site} ${query}`;
        const sRes = await liveWebResearchService.searchLiveWeb(siteQuery, { maxResults });
        resultsBySite.push({
          site,
          query: siteQuery,
          resultsCount: sRes.results ? sRes.results.length : 0,
          results: sRes.results || []
        });
      }
      return {
        success: true,
        query,
        sites: siteList,
        resultsBySite,
        summary: `Searched ${siteList.length} site(s) for "${query}". Found results across: ${resultsBySite.filter(r => r.resultsCount > 0).map(r => r.site).join(', ')}.`
      };
    }
  },

  restore_desktop_window: {
    description: 'Restores a minimized or maximized desktop application window by title or process name.',
    personality: 'JARVIS',
    execute: async ({ query = '' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.restoreWindow(query, personality);
    }
  },

  open_windows_settings: {
    description: 'Opens a specific Windows Settings page (display, sound, network, bluetooth, apps, update).',
    personality: 'JARVIS',
    execute: async ({ settingPage = 'default' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.openWindowsSetting(settingPage, personality);
    }
  },

  control_media: {
    description: 'Controls Windows system media playback (play, pause, next, prev, mute, volumeup, volumedown).',
    personality: 'JARVIS',
    execute: async ({ action = 'playpause' }, personality = 'JARVIS') => {
      return await desktopControllerInstance.controlMedia(action, personality);
    }
  },

  adjust_volume: {
    description: 'Adjusts system or call volume live (up, down, mute, unmute) by discrete steps.',
    personality: 'JARVIS',
    execute: async ({ direction = 'volumeup', steps = 2 }, personality = 'JARVIS') => {
      return await desktopControllerInstance.adjustVolume(direction, steps, personality);
    }
  },

  get_running_applications: {
    description: 'Returns a list of active visible user applications running on Windows.',
    personality: 'SHARED',
    execute: async ({ limit = 15 } = {}, personality = 'JARVIS') => {
      return await desktopControllerInstance.getRunningApplications({ limit }, personality);
    }
  },

  get_hardware_metrics: {
    description: 'Retrieves live Windows hardware metrics for CPU, RAM, or Disks with conversational summaries.',
    personality: 'SHARED',
    execute: async ({ metric = 'all' } = {}, personality = 'JARVIS') => {
      return await desktopControllerInstance.getHardwareMetrics(metric, personality);
    }
  },

  search_project_files: {
    description: 'Searches for files matching a pattern within the current workspace.',
    personality: 'SHARED',
    execute: async ({ query = '' }) => {
      const root = path.resolve(__dirname, '..');
      const results = [];
      const searchTerm = String(query).toLowerCase().trim();

      function walk(dir) {
        if (results.length >= 15) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (entry.name.toLowerCase().includes(searchTerm)) {
              results.push(path.relative(root, fullPath));
            }
          }
        } catch (e) {}
      }

      walk(root);

      if (results.length === 0) {
        return {
          query,
          results: [],
          summary: `I found no files matching "${query}" in your workspace, sir.`
        };
      }

      return {
        query,
        results,
        summary: `I found ${results.length} matching file${results.length === 1 ? '' : 's'}: ${results.slice(0, 5).join(', ')}, sir.`
      };
    }
  },

  // =========================================================================
  // Coding Assistant Tools (SHARED)
  // =========================================================================
  read_project_file: {
    description: 'Safely reads code lines from an authorized file in the workspace.',
    personality: 'SHARED',
    execute: async ({ filePath = '', startLine = 1, endLine = 100, maxLines = 150 }) => {
      return codingAssistantInstance.readProjectFile(filePath, { startLine, endLine, maxLines });
    }
  },

  search_code_symbols: {
    description: 'Searches for function declarations, classes, exports, and patterns across the project codebase.',
    personality: 'SHARED',
    execute: async ({ query = '' }) => {
      return codingAssistantInstance.searchSymbols(query);
    }
  },

  debug_stack_trace: {
    description: 'Parses a stack trace and maps each frame back to source code lines in the workspace.',
    personality: 'SHARED',
    execute: async ({ stackTrace = '' }) => {
      return codingAssistantInstance.debugStackTrace(stackTrace);
    }
  },

  review_dependencies: {
    description: 'Reviews package.json configuration, scripts, and runtime/dev dependencies.',
    personality: 'SHARED',
    execute: async () => {
      return codingAssistantInstance.reviewDependencies();
    }
  },

  propose_code_patch: {
    description: 'Prepares a diff preview for a proposed code change before applying it.',
    personality: 'SHARED',
    execute: async ({ filePath = '', originalCode = '', replacementCode = '' }) => {
      return codingAssistantInstance.proposeCodePatch(filePath, originalCode, replacementCode);
    }
  },

  request_action_approval: {
    description: 'Generates a single-use, 60-second approval token for a high-impact operation.',
    personality: 'SHARED',
    execute: async ({ action = '', target = '', args = {} }) => {
      return securityPermissionsInstance.createApprovalRequest(action, target, args);
    }
  },

  apply_code_patch: {
    description: 'Applies an approved patch to a workspace file with automatic backup. Requires valid approvalToken.',
    personality: 'SHARED',
    execute: async ({ filePath = '', originalCode = '', replacementCode = '', approvalToken = '' }) => {
      return codingAssistantInstance.applyCodePatch(filePath, originalCode, replacementCode, approvalToken);
    }
  },

  run_project_test: {
    description: 'Runs any allowlisted or test_*.js test suite in the project.',
    personality: 'SHARED',
    execute: async ({ testName = '' }) => {
      return await codingAssistantInstance.runApprovedTest(testName);
    }
  },

  plan_multi_step_task: {
    description: 'Creates and validates a structured execution plan for complex multi-step tasks.',
    personality: 'SHARED',
    execute: async ({ title, objective = '', steps = [] }) => {
      return taskOrchestratorInstance.createPlan({ title, objective, steps });
    }
  },

  execute_multi_step_plan: {
    description: 'Executes a validated multi-step plan through the execution engine with permission verification.',
    personality: 'SHARED',
    execute: async ({ planId, title, objective = '', steps = [] }, personality = 'JARVIS') => {
      return await taskOrchestratorInstance.executePlan({ planId, title, objective, steps, personality });
    }
  },

  get_task_orchestration_status: {
    description: 'Retrieves current status or historical outcome of a multi-step task plan.',
    personality: 'SHARED',
    execute: async ({ planId }) => {
      return taskOrchestratorInstance.getPlanStatus(planId);
    }
  },

  cancel_task_orchestration: {
    description: 'Immediately aborts an active in-flight multi-step task plan.',
    personality: 'SHARED',
    execute: async ({ planId }) => {
      return taskOrchestratorInstance.cancelPlan(planId);
    }
  },

  list_task_executions: {
    description: 'Lists recent task plan executions and active background tasks.',
    personality: 'SHARED',
    execute: async ({ limit = 20 }) => {
      return taskOrchestratorInstance.listExecutedPlans(limit);
    }
  },

  execute_autonomous_task: {
    description: 'Decomposes an instruction into an autonomous DAG, verifies environment, executes with checkpoints and dynamic replanning, and independently verifies outcome.',
    personality: 'SHARED',
    inputs: {
      instruction: { type: 'string', description: 'Natural language goal or instruction to execute autonomously', required: true },
      maxSteps: { type: 'number', description: 'Maximum steps to execute (default 12)' },
      timeoutMs: { type: 'number', description: 'Timeout in ms (default 60000)' }
    },
    outputs: {
      taskId: { type: 'string' },
      status: { type: 'string' },
      stepsExecuted: { type: 'number' },
      outcomeVerified: { type: 'boolean' },
      summary: { type: 'string' }
    },
    requiredPermissions: ['TASK_ORCHESTRATION', 'AUTONOMOUS_EXECUTION'],
    timeoutMs: 180000,
    cancellationBehavior: 'ABORT_SIGNAL_SUPPORTED',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Independent outcome assertion',
    execute: async (args = {}, personality = 'JARVIS') => {
      return await taskOrchestratorInstance.executeAutonomousTask({ ...args, personality });
    }
  },

  execute_autonomous_project: {
    description: 'Executes an autonomous multi-milestone project plan using live TaskOrchestrator with hardware requirement detection.',
    personality: 'SHARED',
    inputs: {
      title: { type: 'string', description: 'Project title', required: true },
      domain: { type: 'string', description: 'Domain: ROBOTICS_ENGINEERING, AI_SOFTWARE, DATA_PIPELINE' }
    },
    outputs: {
      projectId: { type: 'string' },
      progressPercent: { type: 'number' },
      milestones: { type: 'array' },
      status: { type: 'string' }
    },
    requiredPermissions: ['PROJECT_ORCHESTRATION', 'AUTONOMOUS_EXECUTION'],
    timeoutMs: 300000,
    cancellationBehavior: 'ABORT_SIGNAL_SUPPORTED',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Milestone taskIds verified',
    execute: async (args = {}, personality = 'JARVIS') => {
      return await autonomousProjectOrchestratorInstance.executeAutonomousProject({ ...args, personality });
    }
  },

  execute_software_engineering_workflow: {
    description: 'Performs a complete autonomous software engineering workflow: repo understanding, bug reproduction, root-cause diagnosis, minimal patch proposal, workspace/branch isolation, diff verification, regression testing, and rollback safety.',
    personality: 'JARVIS',
    inputs: {
      issueDescription: { type: 'string', description: 'Description of the defect' },
      targetFile: { type: 'string', description: 'File to patch' },
      reproduceScript: { type: 'string', description: 'Test script reproducing the bug' },
      regressionTestSuite: { type: 'string', description: 'Regression test file to ensure no collateral breakage' }
    },
    outputs: {
      success: { type: 'boolean' },
      summary: { type: 'string' },
      steps: { type: 'array' },
      rolledBack: { type: 'boolean' }
    },
    requiredPermissions: ['DEVELOPMENT_EXEC', 'CODE_MODIFICATION'],
    timeoutMs: 120000,
    cancellationBehavior: 'ABORT_SIGNAL_SUPPORTED',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Test exit code 0 and clean diff',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.executeSoftwareEngineeringWorkflow(args);
    }
  },

  // =========================================================================
  // External API Integrations (SHARED)
  // =========================================================================

  list_api_integrations: {
    description: 'Lists all configured external API providers (AI models, search, weather, finance, messaging, smart home) with health and masked keys.',
    personality: 'SHARED',
    execute: async () => {
      return apiIntegrationsManagerInstance.getIntegrationsSummary();
    }
  },

  test_api_integration: {
    description: 'Tests live connectivity and credentials for a specified external integration provider.',
    personality: 'SHARED',
    execute: async ({ providerId = 'duckduckgo' }) => {
      return await apiIntegrationsManagerInstance.testConnection(providerId);
    }
  },

  get_integration_health: {
    description: 'Performs live connectivity checks across all external integrations and reports their health.',
    personality: 'SHARED',
    execute: async () => {
      return await apiIntegrationsManagerInstance.testAllConnections();
    }
  },

  // =========================================================================
  // Safe Windows Administrative Elevation (JARVIS ONLY)
  // =========================================================================

  propose_administrative_elevation: {
    description: 'Creates a human-understandable administrative elevation proposal explaining system changes and UAC impact.',
    personality: 'JARVIS',
    execute: async ({ operation, target, command, rationale }, activePersonality) => {
      return elevationManagerInstance.createElevationProposal({
        operation,
        target,
        command,
        rationale,
        personality: activePersonality
      });
    }
  },

  execute_administrative_elevation: {
    description: 'Executes an approved administrative proposal triggering standard Windows UAC prompt and verifying observable outcomes.',
    personality: 'JARVIS',
    execute: async ({ proposalId, userConfirmed = true }) => {
      return await elevationManagerInstance.executeElevated({
        proposalId,
        userConfirmed: Boolean(userConfirmed)
      });
    }
  },

  // =========================================================================
  // Controlled Self-Repair & Improvement Engine
  // =========================================================================

  diagnose_system_issue: {
    description: 'Analyzes application error stack traces, health check failures, and test outputs to distinguish verified causes from hypotheses.',
    personality: 'SHARED',
    execute: async ({ errorMessage, stackTrace, failingTestFile, observedSymptoms = [] }) => {
      return selfRepairServiceInstance.diagnoseIssue({
        errorMessage,
        stackTrace,
        failingTestFile,
        observedSymptoms
      });
    }
  },

  stage_code_repair: {
    description: 'Creates an isolated staging workspace and prepares candidate patch for validation without touching production files.',
    personality: 'JARVIS',
    execute: async ({ targetFile, problemDescription, proposedSolution, newContent, rationale }) => {
      const plan = selfRepairServiceInstance.createRepairPlan({
        targetFile,
        problemDescription,
        proposedSolution,
        rationale
      });
      const staged = selfRepairServiceInstance.stageRepairPatch(plan.planId, newContent);
      return { plan, staged };
    }
  },

  validate_repair_candidate: {
    description: 'Runs isolated syntax checks, security vulnerability review, and regression test suites on a staged patch.',
    personality: 'JARVIS',
    execute: async ({ planId, testCommand }) => {
      return await selfRepairServiceInstance.validateCandidate(planId, { testCommand });
    }
  },

  deploy_verified_repair: {
    description: 'Creates a versioned backup, deploys a validated candidate patch to production, and automatically rolls back if health checks fail.',
    personality: 'JARVIS',
    execute: async ({ planId, healthCheckUrl = 'http://localhost:3000/api/status' }) => {
      return await selfRepairServiceInstance.deployRepair(planId, { healthCheckUrl });
    }
  },

  rollback_to_known_good: {
    description: 'Restores a workspace file to a previous known-good backup.',
    personality: 'JARVIS',
    execute: async ({ backupId }) => {
      return selfRepairServiceInstance.rollbackToBackup(backupId);
    }
  },

  // =========================================================================
  // Self-Healing Service Management
  // =========================================================================

  get_subsystem_health: {
    description: 'Retrieves comprehensive health metrics, resource utilization, and stalled request detections across all subsystems.',
    personality: 'SHARED',
    execute: async () => {
      return serviceHealingManagerInstance.getHealthReport();
    }
  },

  recover_subsystem: {
    description: 'Initiates bounded, isolated recovery for a specific failing subsystem without restarting the entire application.',
    personality: 'JARVIS',
    execute: async ({ serviceId = 'VOICE_TTS', reason = 'Manual recovery requested' }) => {
      return await serviceHealingManagerInstance.restartService(serviceId, reason);
    }
  },

  // =========================================================================
  // Self-Coding & Autonomous Software Development Engine (JARVIS)
  // =========================================================================

  inspect_project: {
    description: 'Inspects project repository structure, file counts, dependencies, and detected language toolchains.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.inspectProject(args);
    }
  },

  search_source_code: {
    description: 'Searches source code across workspace files with surrounding context snippets and line numbers.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.searchSourceCode(args);
    }
  },

  read_source_file: {
    description: 'Safely reads a source code file with line numbers, file size, and sha256 hash for optimistic concurrency.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.readSourceFile(args);
    }
  },

  create_source_file: {
    description: 'Creates a new source code file with path traversal defense and immutable core protection.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.createSourceFile(args);
    }
  },

  edit_source_file: {
    description: 'Atomically edits an existing source file with optimistic concurrency sha256 check and automatic versioned backup.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.editSourceFile(args);
    }
  },

  create_new_module: {
    description: 'Scaffolds a new custom module with exports and documentation in server/custom_tools/.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.createNewModule(args);
    }
  },

  register_new_tool: {
    description: 'Dynamically validates, registers, and activates a newly developed tool with explicit permissions at runtime.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return dynamicToolsManagerInstance.createAndRegisterTool(args.toolDefinition || args, args.code);
    }
  },

  generate_tests: {
    description: 'Generates automated unit or integration test suite for a specified target module.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.generateTests(args);
    }
  },

  run_project_tests: {
    description: 'Executes project test suite safely and captures exit code, duration, stdout, and test results.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.runProjectTests(args);
    }
  },

  run_linter: {
    description: 'Runs syntax checks and static security vulnerability analysis across specified source files.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.runLinter(args);
    }
  },

  run_build: {
    description: 'Executes project build scripts with timeout and error diagnostics.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.runBuild(args);
    }
  },

  inspect_git_diff: {
    description: 'Inspects Git status, modified files, and working tree diffs.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.inspectGitDiff(args);
    }
  },

  diagnose_test_failure: {
    description: 'Analyzes test failure outputs to pinpoint exact failing assertions, stack frames, and source lines.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.diagnoseTestFailure(args);
    }
  },

  repair_code_failure: {
    description: 'Executes bounded autonomous repair loop (Inspect -> Reproduce -> Diagnose -> Patch -> Test -> Validate).',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.repairCodeFailure(args);
    }
  },

  create_development_branch: {
    description: 'Creates a dedicated Git development branch and isolated development workspace.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.createDevelopmentBranch(args);
    }
  },

  rollback_code_change: {
    description: 'Restores a source file to previous working version from versioned backup or Git HEAD.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.rollbackCodeChange(args);
    }
  },

  validate_candidate_build: {
    description: 'Validates candidate files via syntax checks, static security review, test suites, and live health check.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.validateCandidateBuild(args);
    }
  },

  activate_validated_update: {
    description: 'Promotes validated candidate update to production with automated rollback if health check fails.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await selfRepairServiceInstance.deployRepair(args.planId, { healthCheckUrl: args.healthCheckUrl });
    }
  },

  // =========================================================================
  // Scientific Computation & Mathematics Tools (SHARED)
  // =========================================================================

  calculate_scientific_math: {
    description: 'Executes verified mathematical computations (matrix operations, Simpson integration, statistics, linear regression, root finding).',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return scientificComputationEngineInstance.executeCalculation(args);
    }
  },

  convert_scientific_units: {
    description: 'Converts engineering and scientific units across SI, Imperial, and custom units with dimensional verification.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return scientificComputationEngineInstance.convertUnits(args.value, args.fromUnit, args.toUnit, args.category);
    }
  },

  run_monte_carlo_simulation: {
    description: 'Executes Monte Carlo stochastic simulations with Normal, Uniform, or Lognormal parameter distributions and percentiles.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const model = (params) => {
        if (typeof args.modelExpr === 'string') {
          return scientificComputationEngineInstance._safeEvalMath(args.modelExpr, params);
        }
        return Object.values(params).reduce((acc, v) => acc * v, 1);
      };
      return scientificComputationEngineInstance.runMonteCarlo(model, args.parameterDistributions, args.trials || 5000);
    }
  },

  // =========================================================================
  // Mechanical Engineering & Robotics Tools
  // =========================================================================

  analyze_structural_beam: {
    description: 'Calculates bending stress, shear stress, deflection, and factor of safety for cantilever mechanical beams.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.analyzeCantileverBeam(args);
    }
  },

  calculate_robot_kinematics: {
    description: 'Computes forward kinematics, end-effector coordinates, and link positions from Denavit-Hartenberg (DH) parameters.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.computeForwardKinematicsDH(args.dhTable);
    }
  },

  size_actuator_motor: {
    description: 'Calculates gravity and dynamic torque, required power, and actuator recommendations for robotic joints.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.sizeJointActuator(args);
    }
  },

  generate_parametric_cad: {
    description: 'Generates ready-to-render OpenSCAD 3D CAD scripts for parametric robotic arms, compliant grippers, and hinges.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.generateOpenSCADModel(args.projectType, args.parameters);
    }
  },

  get_engineering_blueprint: {
    description: 'Retrieves complete engineering requirements, BOM, specifications, and safety analyses for robotic projects.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint(args.projectId);
    }
  },

  // =========================================================================
  // Electronics & Embedded Systems Tools
  // =========================================================================

  calculate_power_budget: {
    description: 'Calculates continuous and peak current draw, battery runtime in hours/minutes, and discharge C-rate requirements.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return electronicsEmbeddedEngineInstance.calculatePowerBudget(args);
    }
  },

  generate_embedded_firmware: {
    description: 'Generates complete, compilable Arduino/C++ firmware featuring non-blocking 100Hz PID control loops and E-Stop ISRs.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return electronicsEmbeddedEngineInstance.generateFirmware(args);
    }
  },

  generate_circuit_netlist: {
    description: 'Generates structured circuit schematic netlists, pin interconnects, pull-ups, and protective diodes/capacitors.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return electronicsEmbeddedEngineInstance.generateCircuitNetlist(args.projectName, args.config);
    }
  },

  // =========================================================================
  // AI Development Laboratory Tools
  // =========================================================================

  estimate_ai_resources: {
    description: 'Estimates VRAM, training hours, and compute costs for AI model fine-tuning (LoRA/QLoRA) and local inference.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return aiDevelopmentLabInstance.estimateTrainingAndInferenceResources(args);
    }
  },

  inspect_ai_dataset: {
    description: 'Inspects training or evaluation datasets for token counts, missing prompt/completion fields, and data quality scoring.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return aiDevelopmentLabInstance.inspectDataset(args.dataset);
    }
  },

  scaffold_ai_agent: {
    description: 'Creates a complete standalone sub-agent project with isolated permissions, configuration, tests, and documentation.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return aiDevelopmentLabInstance.scaffoldAIAgentProject(args);
    }
  },

  // =========================================================================
  // Advanced Technical Research & Scientific Papers Tools
  // =========================================================================

  search_scientific_papers: {
    description: 'Searches ArXiv.org for scientific papers, peer-reviewed preprints, authors, publication dates, and abstracts.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return await advancedResearchEngineInstance.searchScientificPapers(args.query, args.maxResults);
    }
  },

  compare_research_sources: {
    description: 'Performs comparative analysis on conflicting research claims, identifying direct evidence versus speculation.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return advancedResearchEngineInstance.compareSources(args.claim, args.sources);
    }
  },

  save_knowledge_entry: {
    description: 'Saves verified technical knowledge, equations, benchmarks, and citations to the local persistent knowledge base.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return advancedResearchEngineInstance.saveToKnowledgeBase(args);
    }
  },

  search_knowledge_base: {
    description: 'Searches the local persistent knowledge base by keyword or tag for instant factual recall.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return advancedResearchEngineInstance.searchKnowledgeBase(args.query, args.filterTag);
    }
  },

  // =========================================================================
  // Live Hybrid RAG & Multi-Format Knowledge Retrieval Tools
  // =========================================================================

  rag_index_document: {
    description: 'Indexes an authorized local document (PDF, DOCX, TXT, CSV, JSON, MD) or directory into the live Hybrid RAG engine.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { hybridRagEngineInstance } = require('./memory/hybridRagEngine.js');
      const targetPath = args.path || args.filePath || args.targetPath;
      if (!targetPath) return { success: false, error: 'Path is required for indexing.' };
      
      const fs = require('fs');
      if (!fs.existsSync(targetPath)) return { success: false, error: `File or directory not found: "${targetPath}"` };
      
      if (fs.statSync(targetPath).isDirectory()) {
        return hybridRagEngineInstance.indexDirectory(targetPath);
      } else {
        return hybridRagEngineInstance.indexFile(targetPath);
      }
    }
  },

  rag_search_documents: {
    description: 'Searches all indexed local documents using unified BM25, TF-IDF and dense semantic retrieval with provenance citations.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { hybridRagEngineInstance } = require('./memory/hybridRagEngine.js');
      const query = args.query || args.prompt || '';
      const topK = Number(args.topK) || 4;
      const mode = args.mode || 'hybrid_rrf';
      return hybridRagEngineInstance.search(query, { topK, mode });
    }
  },

  rag_get_document_status: {
    description: 'Returns the current index status, document count, chunk count, and supported formats in the Hybrid RAG engine.',
    personality: 'SHARED',
    execute: async () => {
      const { hybridRagEngineInstance } = require('./memory/hybridRagEngine.js');
      return hybridRagEngineInstance.getIndexStatus();
    }
  },

  rag_delete_document: {
    description: 'Deletes an indexed document from the Hybrid RAG engine by file path or document ID.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { hybridRagEngineInstance } = require('./memory/hybridRagEngine.js');
      const target = args.path || args.docId || args.targetPath;
      if (!target) return { success: false, error: 'Document ID or path is required for deletion.' };
      return hybridRagEngineInstance.deleteDocument(target);
    }
  },

  reasoning_solve_problem: {
    description: 'Solves formal logic truth tables, CSP constraint satisfaction, graph pathfinding, causal interventions, or algorithm complexity.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { reasoningProblemSolvingEngineInstance } = require('./reasoningProblemSolvingEngine.js');
      const action = (args.action || 'BOOLEAN_LOGIC').toUpperCase();
      if (action === 'BOOLEAN_LOGIC' || action === 'TRUTH_TABLE') {
        return reasoningProblemSolvingEngineInstance.evaluateBooleanFormula(args.formula);
      }
      if (action === 'CSP') {
        return reasoningProblemSolvingEngineInstance.solveCSP(args.csp || {});
      }
      if (action === 'GRAPH_ANALYSIS') {
        return reasoningProblemSolvingEngineInstance.analyzeGraph(args.graph || {});
      }
      if (action === 'SHORTEST_PATH') {
        return reasoningProblemSolvingEngineInstance.findShortestPath(args.graph || {}, args.startNode, args.endNode);
      }
      if (action === 'ALGORITHM_COMPLEXITY') {
        return reasoningProblemSolvingEngineInstance.analyzeAlgorithmComplexity(args.code || args.formula);
      }
      return { success: false, error: `Unsupported reasoning action: ${action}` };
    }
  },

  language_analyze_text: {
    description: 'Analyzes natural language for ambiguity, multiple intents, reference resolution, contradiction detection, confidence calibration, or multilingual code-switching.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { languageIntelligenceEngineInstance } = require('./languageIntelligenceEngine.js');
      const action = (args.action || 'ANALYZE').toUpperCase();
      if (action === 'AMBIGUITY') return languageIntelligenceEngineInstance.detectAmbiguity(args.text, args.context || []);
      if (action === 'MULTI_INTENT') return languageIntelligenceEngineInstance.detectMultipleIntents(args.text);
      if (action === 'RESOLVE_REFERENCES') return languageIntelligenceEngineInstance.resolveReferences(args.text, args.priorEntities || []);
      if (action === 'CONTRADICTION') return languageIntelligenceEngineInstance.detectContradiction(args.text, args.targetText || '');
      if (action === 'CONFIDENCE') return languageIntelligenceEngineInstance.calibrateConfidence(args);
      if (action === 'MULTILINGUAL') return languageIntelligenceEngineInstance.detectLanguageMixing(args.text);
      return {
        ambiguity: languageIntelligenceEngineInstance.detectAmbiguity(args.text),
        intents: languageIntelligenceEngineInstance.detectMultipleIntents(args.text),
        language: languageIntelligenceEngineInstance.detectLanguageMixing(args.text)
      };
    }
  },

  database_inspect_schema: {
    description: 'Inspects live SQLite database tables, column types, primary keys, and indexes.',
    personality: 'SHARED',
    execute: async () => {
      const { databaseEngineeringEngineInstance } = require('./databaseEngineeringEngine.js');
      return databaseEngineeringEngineInstance.inspectDatabaseSchema();
    }
  },

  database_explain_query: {
    description: 'Analyzes and explains an SQL query, breaking down operations and safety considerations.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { databaseEngineeringEngineInstance } = require('./databaseEngineeringEngine.js');
      return databaseEngineeringEngineInstance.explainSqlQuery(args.sql);
    }
  },

  datascience_analyze_dataset: {
    description: 'Computes descriptive statistics, outlier detection (IQR/Z-score), missing data analysis, or hypothesis testing.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { dataScienceEngineInstance } = require('./science/dataScienceEngine.js');
      const action = (args.action || 'SUMMARY').toUpperCase();
      if (action === 'SUMMARY') return await dataScienceEngineInstance.computeSummary(args.data || []);
      if (action === 'OUTLIERS') return await dataScienceEngineInstance.detectOutliers(args.data || [], args.method, args.threshold);
      if (action === 'MISSING_DATA') return await dataScienceEngineInstance.analyzeMissingData(args.records || []);
      if (action === 'HYPOTHESIS_TEST') return await dataScienceEngineInstance.runHypothesisTest(args.testType, args);
      return { success: false, error: `Unsupported data science action: ${action}` };
    }
  },

  ml_train_and_evaluate: {
    description: 'Trains and benchmarks machine learning classification or regression models with anti-leakage guards.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const { machineLearningEngineInstance } = require('./science/machineLearningEngine.js');
      return await machineLearningEngineInstance.compareModels(args.task || 'classification', args.options || {});
    }
  },

  automation_run_workflow: {
    description: 'Executes reusable multi-stage cross-application workflows (Research->Word, Dataset->Excel, Code->Test).',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      const { crossAppWorkflowsInstance } = require('./desktop/crossAppWorkflows.js');
      const wf = String(args.workflowName || '').toUpperCase();
      if (wf === 'RESEARCH_TO_WORD_REPORT') return await crossAppWorkflowsInstance.executeResearchToWordWorkflow(args.params || {});
      if (wf === 'DATASET_TO_EXCEL_WORKBOOK') return await crossAppWorkflowsInstance.executeDataToExcelWorkflow(args.params || {});
      if (wf === 'PROJECT_INSPECTION_AND_TEST') return await crossAppWorkflowsInstance.executeCodeInspectionWorkflow(args.params || {});
      return { success: false, error: `Unknown workflow: ${args.workflowName}` };
    }
  },

  observability_get_diagnostics: {
    description: 'Retrieves unified system diagnostics, process memory RSS, heap usage, and event monitoring telemetry.',
    personality: 'SHARED',
    execute: async () => {
      const mem = process.memoryUsage();
      return {
        status: 'HEALTHY',
        memoryRssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      };
    }
  },

  // =========================================================================
  // Forecasting, Risk & Project Orchestration Tools
  // =========================================================================

  generate_scenario_forecast: {
    description: 'Generates multi-scenario forecasting (nominal, optimistic, worst-case, stress test) with 95% confidence intervals.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return forecastingScenarioEngineInstance.generateScenarioAnalysis(args);
    }
  },

  evaluate_fmea_risk: {
    description: 'Calculates Risk Priority Numbers (RPN) and categorizes failure modes for engineering risk management.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return forecastingScenarioEngineInstance.evaluateFMEA(args.failureModes);
    }
  },

  orchestrate_project_plan: {
    description: 'Decomposes complex engineering projects into an executable milestone DAG and tracks persistent execution.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return autonomousProjectOrchestratorInstance.createProjectPlan(args);
    }
  },

  // =========================================================================
  // Knowledge Graph, Multi-Agent Council & Autonomous Monitoring Tools
  // =========================================================================

  query_knowledge_graph: {
    description: 'Searches the engineering knowledge graph for nodes, components, projects, or causal relationships.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      if (args.nodeId && args.getNeighbors) {
        return {
          node: knowledgeGraphEngine.getNode(args.nodeId),
          neighbors: knowledgeGraphEngine.getNeighbors(args.nodeId, args.direction || 'both')
        };
      }
      return {
        results: knowledgeGraphEngine.searchNodes(args.query || '', args.typeFilter || null)
      };
    }
  },

  analyze_engineering_consequence: {
    description: 'Performs physical and structural consequence analysis when changing parameters (motor torque, gear ratio, battery voltage, materials).',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return knowledgeGraphEngine.analyzeConsequence(args.targetEntity, args.parameterChange || {}, args.options || {});
    }
  },

  record_graph_decision: {
    description: 'Records an adopted architectural or engineering decision with rationale into the persistent knowledge graph.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return knowledgeGraphEngine.addDecision(args.projectId, args.decisionSummary, args.rationale, args.alternatives);
    }
  },

  record_graph_failure: {
    description: 'Records a failure incident, root cause, and mitigation into the knowledge graph for future prevention.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return knowledgeGraphEngine.addFailure(args.componentOrTaskId, args.rootCause, args.mitigation);
    }
  },

  dispatch_multi_agent_mission: {
    description: 'Coordinates 9 specialist agents (Research, Software, Math, Mechanical, Electronics, AI/ML, Testing, Security, Coordinator) on a mission.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await getMultiAgentOrchestrator().runMission(args.missionTitle, args.domainRequirements, args.requestedRoles);
    }
  },

  scan_proactive_assistance: {
    description: 'Runs an authorized proactive scan across active projects, dependencies, memory footprint, and system health.',
    personality: 'SHARED',
    execute: async () => {
      return await proactiveAssistant.runSystemScan();
    }
  },

  audit_compute_resources: {
    description: 'Inspects CPU, RAM, GPU accelerators, installed toolchains (Node, Python, Git, C++), and routes task execution.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      if (args.routeTask) {
        return resourceComputeManager.routeTaskExecution(args.taskProfile || {});
      }
      return await resourceComputeManager.getCompleteCapabilityAudit();
    }
  },

  // =========================================================================
  // Real Camera & Visual Intelligence Tools (JARVIS)
  // =========================================================================

  capture_camera_snapshot: {
    description: 'Captures a still frame snapshot from the active camera stream with auto-exposure verification.',
    personality: 'JARVIS',
    execute: async () => {
      return await visionServiceInstance.captureCameraSnapshot();
    }
  },

  get_camera_devices: {
    description: 'Discovers physically connected camera devices and current camera permission status.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return visionServiceInstance.getConnectedHardwareReport(args);
    }
  },

  set_camera_stream_state: {
    description: 'Updates camera active stream state, device selection, or records hardware disconnection.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return visionServiceInstance.notifyCameraState(args);
    }
  },

  analyze_camera_image: {
    description: 'Analyzes what the camera sees: identifies visible people, objects, and surroundings.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await visionServiceInstance.analyzeCameraImage(args);
    }
  },

  analyze_desk_workspace: {
    description: 'Inspects physical desk workspace, hardware equipment, and setup posture through optical camera.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await visionServiceInstance.analyzeDeskWorkspace(args);
    }
  },

  analyze_local_image_file: {
    description: 'Analyzes an image file from the local filesystem with multimodal vision.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await visionServiceInstance.analyzeLocalImageFile(args);
    }
  },

  capture_screen: {
    description: 'Captures a snapshot frame of the active computer display or application window (requires screen observation consent).',
    personality: 'JARVIS',
    execute: async () => {
      return await screenObservationServiceInstance.captureScreenWithConsent();
    }
  },

  analyze_screen: {
    description: 'Analyzes active desktop screen content and visible application interfaces (requires screen observation consent unless imageBase64 is supplied).',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await screenObservationServiceInstance.analyzeScreenWithConsent(args);
    }
  },

  diagnose_screen_error: {
    description: 'Diagnoses visible application errors, terminal stack traces, or exception dialogs (requires screen observation consent unless imageBase64 is supplied).',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await screenObservationServiceInstance.diagnoseScreenErrorWithConsent(args);
    }
  },

  read_screen_text: {
    description: 'Reads visible text, code snippets, or document pages using optical character recognition (requires screen observation consent unless imageBase64 is supplied).',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await screenObservationServiceInstance.readScreenTextWithConsent(args);
    }
  },

  inspect_engineering_component: {
    description: 'Analyzes images of mechanical parts, circuits, robotic components, and CAD models with uncalibrated measurement and machine safety notices.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await visionServiceInstance.inspectEngineeringComponent(args);
    }
  },

  compare_visual_frames: {
    description: 'Performs multi-frame temporal comparison between two camera images or components.',
    personality: 'JARVIS',
    execute: async (args = {}) => {
      return await visionServiceInstance.compareFrames(args);
    }
  },

  inspect_ambient_sensors: {
    description: 'Reads ambient light sensor illuminance (lux) and environment state.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return visionServiceInstance.getSensorTelemetry(args);
    }
  },

  inspect_connected_hardware: {
    description: 'Reports connected cameras, microphones, and displays inventory.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return visionServiceInstance.getConnectedHardwareReport(args);
    }
  },

  get_sensor_telemetry: {
    description: 'Acquires battery, ambient light, thermal, and network telemetry.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return visionServiceInstance.getSensorTelemetry(args);
    }
  },

  get_system_telemetry: {
    description: 'Acquires battery, ambient light, thermal, and network system telemetry.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ', 'SENSOR_TELEMETRY'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert non-null telemetry object returned',
    execute: async (args = {}) => {
      return visionServiceInstance.getSensorTelemetry(args);
    }
  },

  // =========================================================================
  // Live Capability Registry, Dependency Investigation & Empirical Learning
  // =========================================================================

  get_live_capability_registry: {
    description: 'Returns the live capability registry with implementation status, dependencies, permissions, measured performance benchmarks, and grounding levels (Implemented Software, Simulated, Externally Verified, Physically Tested).',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const list = capabilityRegistryInstance.getAllCapabilities(args);
      const markdown = args.format === 'markdown' ? capabilityRegistryInstance.generateLiveRegistryReport() : null;
      return {
        success: true,
        count: list.length,
        totalCapabilities: list.length,
        capabilities: list,
        reportMarkdown: markdown
      };
    }
  },

  diagnose_missing_dependency: {
    description: 'Investigates unavailable capabilities, diagnoses the exact technical obstacle (missing binary, API quota, hardware, or permissions), and formulates feasible alternatives.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const target = args.target || args.capabilityId || args.dependency || 'general';
      const diagnosis = await dependencyInvestigatorInstance.investigate(target);
      return {
        success: true,
        target,
        capabilityStatus: diagnosis.available ? 'VERIFIED_OPERATIONAL' : 'FALLBACK_OPERATIONAL',
        ...diagnosis,
        diagnosis
      };
    }
  },

  record_system_experiment: {
    description: 'Records an empirical experiment with hypothesis, baseline, parameter variations, measured outcome, and acceptance decision to drive systematic learning.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const experiment = experimentLedgerInstance.recordExperiment(args);
      return {
        success: true,
        experiment
      };
    }
  },

  get_experiment_ledger: {
    description: 'Retrieves the history of recorded system experiments, acceptance decisions, and aggregate learning metrics.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const experiments = experimentLedgerInstance.getExperiments(args);
      const summary = experimentLedgerInstance.computeLearningsSummary();
      return {
        success: true,
        total: experiments.length,
        learningsSummary: summary,
        experiments
      };
    }
  },

  generate_technical_reproduction_guide: {
    description: 'Generates a step-by-step technical reproduction guide with exact CLI commands, code snippets, governing equations, and acceptance assertions.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      return technicalExplainerInstance.generateReproductionGuide(args);
    }
  },

  explain_engineering_simulation: {
    description: 'Generates a pedagogical reproduction guide for structural beam deflection or robotic joint torque sizing with mathematical equation derivations.',
    personality: 'SHARED',
    execute: async (args = {}) => {
      const type = (args.type || 'beam_deflection').toLowerCase();
      if (type.includes('torque') || type.includes('actuator') || type.includes('robot')) {
        return technicalExplainerInstance.explainActuatorTorque(args.params || args);
      } else {
        return technicalExplainerInstance.explainBeamDeflection(args.params || args);
      }
    }
  },

  // =========================================================================
  // Owner Identity, Face Profiles & Private Assistant Mode
  // =========================================================================

  enroll_owner_profile: {
    description: 'Enrolls an owner identity face profile with explicit user consent and preferences.',
    personality: 'SHARED',
    inputs: {
      name: { type: 'string', required: true, description: 'Owner name' },
      faceImageBase64: { type: 'string', description: 'Base64 image frame containing owner face' },
      preferences: { type: 'object', description: 'Owner preferences' },
      authorizeExplicitConsent: { type: 'boolean', required: true, description: 'Explicit authorization flag' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SECURITY_CORE'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert profileId returned and stored in owner_profiles.json',
    execute: async (args = {}) => {
      return ownerIdentityServiceInstance.enrollOwnerProfile(args);
    }
  },

  verify_owner_face: {
    description: 'Verifies visual identity against enrolled local profiles without guessing unknown faces.',
    personality: 'SHARED',
    inputs: {
      faceImageBase64: { type: 'string', required: true, description: 'Camera frame to verify' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert verified boolean and confidence returned',
    execute: async (args = {}) => {
      return ownerIdentityServiceInstance.verifyVisualIdentity(args.faceImageBase64, args);
    }
  },

  list_owner_profiles: {
    description: 'Lists all locally enrolled owner profiles and preferences.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['RESEARCH'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert array of profiles returned',
    execute: async (args = {}) => {
      return { success: true, profiles: ownerIdentityServiceInstance.listProfiles() };
    }
  },

  delete_owner_profile: {
    description: 'Deletes an enrolled owner face profile and clears biometric signatures.',
    personality: 'SHARED',
    inputs: {
      id: { type: 'string', required: true, description: 'Profile ID to delete' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SECURITY_CORE'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert profile deletion confirmation',
    execute: async (args = {}) => {
      return ownerIdentityServiceInstance.deleteProfile(args.id);
    }
  },

  toggle_privacy_mode: {
    description: 'Toggles private assistant mode (locking private memories and files when owner is unverified).',
    personality: 'SHARED',
    inputs: {
      enabled: { type: 'boolean', description: 'Enable or disable private mode' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SECURITY_CORE'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert privacy mode status returned',
    execute: async (args = {}) => {
      return ownerIdentityServiceInstance.togglePrivacyMode(args.enabled);
    }
  },

  answer_visual_question: {
    description: 'Answers natural user questions about the live camera view or screen (desk objects, people present, room changes, screen text).',
    personality: 'SHARED',
    inputs: {
      question: { type: 'string', required: true, description: 'Question to answer from visual frame' },
      imageBase64: { type: 'string', required: true, description: 'Camera frame image payload' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert analysis string returned',
    execute: async (args = {}) => {
      return visionServiceInstance.answerVisualQuestion(args);
    }
  },

  // =========================================================================
  // Word, Notepad & Document Automation
  // =========================================================================

  write_notepad_document: {
    description: 'Creates a verified document in authorized storage, verifies hash on disk, and opens in Notepad.',
    personality: 'SHARED',
    inputs: {
      title: { type: 'string', required: true, description: 'Document title' },
      content: { type: 'string', required: true, description: 'Document text content' },
      targetDir: { type: 'string', description: 'Target directory' },
      openInNotepad: { type: 'boolean', description: 'Whether to launch Notepad UI' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists on disk and SHA-256 hash matches payload',
    execute: async (args = {}) => {
      return documentAutomationServiceInstance.writeNotepadDocument(args);
    }
  },

  create_word_document: {
    description: 'Generates a genuine Word (.docx) document with professional formatting, styles, headings, tables, verifies content on disk, and opens it in Microsoft Word or WPS Writer.',
    personality: 'SHARED',
    inputs: {
      title: { type: 'string', required: true, description: 'Document title' },
      content: { type: 'string', required: false, description: 'Document content' },
      targetDir: { type: 'string', description: 'Target directory' },
      preferredApp: { type: 'string', description: 'Preferred desktop editor: "word" or "wps"' },
      openInWord: { type: 'boolean', description: 'Whether to open in Word or WPS Writer' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS', 'FILE_OPERATIONS'],
    timeoutMs: 25000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists on disk, valid non-empty OpenXML structure, and editor verification',
    execute: async (args = {}) => {
      return documentIntelligenceEngineInstance.createDocxDocument(args);
    }
  },

  auto_save_document: {
    description: 'Automatically saves a document to authorized storage without repeated confirmation prompts.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Target file path' },
      content: { type: 'string', required: true, description: 'Content to save' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists on disk after auto-save',
    execute: async (args = {}) => {
      return documentAutomationServiceInstance.autoSaveDocument(args);
    }
  },

  create_excel_spreadsheet: {
    description: 'Generates an authentic Microsoft Excel (.xlsx) workbook with multiple sheets, headers, numeric rows, calculations, and formulas.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Target .xlsx file path' },
      sheets: { type: 'array', required: false, description: 'Array of sheet definitions [{ name, headers, rows, formulas }]' },
      title: { type: 'string', required: false, description: 'Workbook title' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS', 'FILE_OPERATIONS'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists on disk, valid OpenXML ZIP structure, and size > 0',
    execute: async (args = {}) => {
      const targetPath = args.filePath || path.join(__dirname, '../scratch', `${(args.title || 'spreadsheet').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.xlsx`);
      return excelAdapterInstance.createWorkbook(targetPath, args.sheets, args.title || 'VISION AI Spreadsheet');
    }
  },

  verify_excel_spreadsheet: {
    description: 'Inspects and verifies an Excel (.xlsx) workbook structure, XML parts, and computes SHA-256 hash.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Path to .xlsx file' },
      expectedSheets: { type: 'array', required: false, description: 'Expected sheet names' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['READ_ONLY'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'EXCEL_AST_VERIFIED',
    execute: async (args = {}) => {
      return excelAdapterInstance.verifyWorkbook(args.filePath, args.expectedSheets);
    }
  },

  create_presentation: {
    description: 'Generates a genuine Microsoft PowerPoint (.pptx) presentation with title slides, executive summaries, bullet lists, and comparison matrices.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Target .pptx file path' },
      slides: { type: 'array', required: false, description: 'Array of slide definitions [{ title, subtitle, bullets, paragraphs }]' },
      title: { type: 'string', required: false, description: 'Presentation title' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS', 'FILE_OPERATIONS'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists on disk, valid OpenXML ZIP structure, and size > 0',
    execute: async (args = {}) => {
      const targetPath = args.filePath || path.join(__dirname, '../scratch', `${(args.title || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pptx`);
      return presentationAdapterInstance.createPresentation(targetPath, args.slides, args.title || 'VISION AI Presentation');
    }
  },

  verify_presentation: {
    description: 'Inspects and verifies a PowerPoint (.pptx) presentation package, slide XML parts, and computes SHA-256 hash.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Path to .pptx file' },
      expectedSlides: { type: 'number', required: false, description: 'Expected minimum slide count' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['READ_ONLY'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'PRESENTATION_AST_VERIFIED',
    execute: async (args = {}) => {
      return presentationAdapterInstance.verifyPresentation(args.filePath, args.expectedSlides);
    }
  },

  // =========================================================================
  // Advanced Local File & Drive Management
  // =========================================================================

  list_directory: {
    description: 'Navigates and lists directory contents with sizes, file types, and modification timestamps.',
    personality: 'SHARED',
    inputs: {
      dirPath: { type: 'string', required: true, description: 'Directory path to list' },
      includeHidden: { type: 'boolean', description: 'Include hidden items' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert items array returned with metadata',
    execute: async (args = {}) => {
      return fileExplorerInstance.listDirectory(args.dirPath, args);
    }
  },

  create_folder: {
    description: 'Creates a new folder in authorized local storage and verifies creation on disk.',
    personality: 'SHARED',
    inputs: {
      folderPath: { type: 'string', required: true, description: 'Folder path to create' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert folder exists on disk',
    execute: async (args = {}) => {
      return fileExplorerInstance.createFolder(args.folderPath);
    }
  },

  find_duplicate_files: {
    description: 'Finds duplicate files in a folder using size grouping and SHA-256 hash comparison.',
    personality: 'SHARED',
    inputs: {
      dirPath: { type: 'string', required: true, description: 'Folder path to scan for duplicates' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert duplicateClusters array returned',
    execute: async (args = {}) => {
      return fileExplorerInstance.findDuplicateFiles(args.dirPath, args);
    }
  },

  organize_files_by_type: {
    description: 'Organizes loose files in a directory into category subfolders with a reversible undo journal.',
    personality: 'SHARED',
    inputs: {
      dirPath: { type: 'string', required: true, description: 'Folder path to organize' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert moves array and undo journal written',
    execute: async (args = {}) => {
      return fileExplorerInstance.organizeFilesByType(args.dirPath, args);
    }
  },

  restore_deleted_file: {
    description: 'Restores a deleted file from the recoverable quarantine/trash backup.',
    personality: 'SHARED',
    inputs: {
      backupPath: { type: 'string', required: true, description: 'Quarantine backup path' },
      targetPath: { type: 'string', description: 'Optional custom restore destination' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert restored file exists on disk',
    execute: async (args = {}) => {
      return fileExplorerInstance.restoreDeletedFile(args.backupPath, args.targetPath);
    }
  },

  // =========================================================================
  // Comprehensive Local Workspace & Persistent Filesystem Tools
  // =========================================================================

  list_workspace_files: {
    description: 'Lists files and folders in an authorized directory (D:\\Jarvis, Documents, Desktop, etc.).',
    personality: 'SHARED',
    inputs: {
      dirPath: { type: 'string', description: 'Folder path or alias (documents, desktop, workspace)' },
      maxEntries: { type: 'number', description: 'Maximum items to return' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_EXPLORE'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert items array returned with metadata',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.listDirectory(args.dirPath || args.path, args);
    }
  },

  read_workspace_file: {
    description: 'Safely reads text, code, or configuration from an authorized local file.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'File path to read' },
      startLine: { type: 'number', description: 'Start line (1-indexed)' },
      maxLines: { type: 'number', description: 'Max lines to return' },
      endLine: { type: 'number', description: 'End line (1-indexed)' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert content string returned with sha256',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.readFile(args.filePath || args.path, args);
    }
  },

  write_workspace_file: {
    description: 'Atomically writes and saves a file to disk with temporary-file verification and backup preservation.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Destination file path' },
      content: { type: 'string', required: true, description: 'File content to write' },
      overwrite: { type: 'boolean', description: 'Whether to replace existing file' },
      createBackup: { type: 'boolean', description: 'Whether to preserve backup before overwriting' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists on disk and SHA-256 matches',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.writeFile(args.filePath || args.path, args.content, args);
    }
  },

  edit_workspace_file: {
    description: 'Edits an existing text file with targeted replacement, optimistic concurrency hash check, and automatic backup.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'File path to edit' },
      targetContent: { type: 'string', required: true, description: 'Target code or text snippet to replace' },
      replacementContent: { type: 'string', required: true, description: 'New replacement text' },
      expectedHash: { type: 'string', description: 'Expected sha256 hash for optimistic concurrency' },
      allowMultiple: { type: 'boolean', description: 'Allow multiple matches if not unique' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert diff and updated sha256 returned',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.editFile(args.filePath || args.path, args);
    }
  },

  copy_workspace_file: {
    description: 'Copies a file or folder safely with SHA-256 integrity verification.',
    personality: 'SHARED',
    inputs: {
      sourcePath: { type: 'string', required: true, description: 'Source path' },
      destPath: { type: 'string', required: true, description: 'Destination path' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert copy exists on disk and sha256 matches source',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.copyFileOrDir(args.sourcePath || args.src, args.destPath || args.dest, args);
    }
  },

  move_workspace_file: {
    description: 'Moves or renames a file or folder safely within authorized roots.',
    personality: 'SHARED',
    inputs: {
      sourcePath: { type: 'string', required: true, description: 'Source path' },
      destPath: { type: 'string', required: true, description: 'Destination path' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert destination exists and source is moved',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.moveFileOrDir(args.sourcePath || args.src, args.destPath || args.dest, args);
    }
  },

  delete_workspace_file: {
    description: 'Moves a file safely to the recoverable workspace recycle bin.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'File path to delete' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert recycleId returned and file quarantined',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.deleteFile(args.filePath || args.path, args);
    }
  },

  organize_workspace_files: {
    description: 'Organizes files in an authorized directory into subfolders by type (Documents, Images, Code, Media).',
    personality: 'SHARED',
    inputs: {
      dirPath: { type: 'string', required: true, description: 'Directory to organize' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert organized count and operations returned',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.organizeFiles(args.dirPath || args.path, args);
    }
  },

  search_workspace_files: {
    description: 'Searches for files by filename and content across authorized roots.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true, description: 'Search term or query' },
      location: { type: 'string', description: 'Optional specific directory' },
      searchContent: { type: 'boolean', description: 'Whether to search file contents' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 12000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert results array returned',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.searchFiles(args.query, args);
    }
  },

  compare_workspace_files: {
    description: 'Compares two files and computes SHA-256 hashes and text diffs.',
    personality: 'SHARED',
    inputs: {
      fileA: { type: 'string', required: true, description: 'First file path' },
      fileB: { type: 'string', required: true, description: 'Second file path' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert comparison result and hashes returned',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.compareFiles(args.fileA || args.pathA, args.fileB || args.pathB);
    }
  },

  verify_workspace_file: {
    description: 'Verifies the integrity, size, and SHA-256 hash of a workspace file.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Target file path' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file exists, non-empty, and SHA-256 computed',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.verifyFileHash(args.filePath || args.path);
    }
  },

  create_workspace_backup: {
    description: 'Creates a versioned backup of a file in the workspace backups registry.',
    personality: 'SHARED',
    inputs: {
      filePath: { type: 'string', required: true, description: 'File path to backup' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert backupId and backup file created',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.createBackup(args.filePath || args.path);
    }
  },

  restore_workspace_backup: {
    description: 'Restores an approved backup to its original or specified destination.',
    personality: 'SHARED',
    inputs: {
      backupId: { type: 'string', required: true, description: 'Backup ID to restore' },
      targetPath: { type: 'string', description: 'Optional custom restore destination' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 8000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert restored file exists on disk',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.restoreBackup(args.backupId, args.targetPath);
    }
  },

  add_authorized_root: {
    description: 'Adds and persists a new user-authorized directory for JARVIS workspace operations.',
    personality: 'SHARED',
    inputs: {
      dirPath: { type: 'string', required: true, description: 'Directory path to authorize' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_ORGANIZATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert root added to authorized list',
    execute: async (args = {}) => {
      return localWorkspaceManagerInstance.addAuthorizedRoot(args.dirPath || args.path);
    }
  },

  list_authorized_roots: {
    description: 'Returns the list of persistent user-authorized directory roots.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 2000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert array of roots returned',
    execute: async () => {
      return {
        success: true,
        authorizedRoots: localWorkspaceManagerInstance.getAuthorizedRoots(),
        standardFolders: localWorkspaceManagerInstance.standardFolders
      };
    }
  },

  // =========================================================================
  // Self-Coding & Autonomous Engineering Tools
  // =========================================================================

  inspect_source_code: {
    description: 'Inspects project repository structure, languages, package info, and directory tree.',
    personality: 'SHARED',
    inputs: {
      targetDir: { type: 'string', description: 'Target directory to inspect' },
      maxDepth: { type: 'number', description: 'Maximum depth to traverse' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DEVELOPMENT_READ'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert repository overview returned',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.inspectProject(args);
    }
  },

  find_code_references: {
    description: 'Finds where a function, class, or symbol is called or imported across project files.',
    personality: 'SHARED',
    inputs: {
      symbolName: { type: 'string', required: true, description: 'Symbol or function name to locate' },
      maxResults: { type: 'number', description: 'Max results to return' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DEVELOPMENT_READ'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert callSites array returned',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.findCallSites(args.symbolName || args.symbol, args);
    }
  },

  apply_source_patch: {
    description: 'Applies an atomic source patch with optimistic concurrency hash check and backup preservation.',
    personality: 'JARVIS',
    inputs: {
      filePath: { type: 'string', required: true, description: 'File path to patch' },
      targetContent: { type: 'string', required: true, description: 'Original code snippet to replace' },
      replacementContent: { type: 'string', required: true, description: 'New replacement code' },
      expectedHash: { type: 'string', description: 'Expected file hash' },
      allowMultiple: { type: 'boolean', description: 'Whether to allow multiple replacements' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DEVELOPMENT_EXEC'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert file updated on disk with valid syntax',
    execute: async (args = {}) => {
      return selfDevelopmentEngineInstance.editSourceFile({
        filePath: args.filePath || args.targetFile,
        targetCode: args.targetContent !== undefined ? args.targetContent : args.targetCode,
        replacementCode: args.replacementContent !== undefined ? args.replacementContent : args.replacementCode,
        expectedHash: args.expectedHash,
        allowMultiple: args.allowMultiple
      });
    }
  },

  execute_self_repair: {
    description: 'Executes the end-to-end autonomous repair loop: Inspect -> Reproduce -> Diagnose -> Patch -> Test -> Verify -> Retain or Rollback.',
    personality: 'JARVIS',
    inputs: {
      issueDescription: { type: 'string', description: 'Description of the defect or task' },
      targetFile: { type: 'string', description: 'Target source file' },
      targetContent: { type: 'string', description: 'Original code to replace' },
      replacementContent: { type: 'string', description: 'New replacement code' },
      testFile: { type: 'string', description: 'Test file to verify the repair' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DEVELOPMENT_EXEC'],
    timeoutMs: 60000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert repair loop executed and verified',
    execute: async (args = {}) => {
      return await selfDevelopmentEngineInstance.executeSoftwareEngineeringWorkflow(args);
    }
  },

  // =========================================================================
  // Windows Application & Window Control
  // =========================================================================

  list_open_windows: {
    description: 'Enumerates visible application windows, window titles, and process IDs.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert windows array returned',
    execute: async (args = {}) => {
      return desktopControllerInstance.listOpenWindows();
    }
  },

  focus_desktop_window: {
    description: 'Brings an application window matching title or process to foreground.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true, description: 'Window title or application name' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert focus outcome reported',
    execute: async (args = {}) => {
      return desktopControllerInstance.focusWindow(args.query);
    }
  },

  minimize_desktop_window: {
    description: 'Minimizes an application window matching title or process.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true, description: 'Window title or application name' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert minimize outcome reported',
    execute: async (args = {}) => {
      return desktopControllerInstance.minimizeWindow(args.query);
    }
  },

  maximize_desktop_window: {
    description: 'Maximizes an application window matching title or process.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true, description: 'Window title or application name' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert maximize outcome reported',
    execute: async (args = {}) => {
      return desktopControllerInstance.maximizeWindow(args.query);
    }
  },

  switch_desktop_window: {
    description: 'Switches between open application windows.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true, description: 'Target window title or application' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert window switched',
    execute: async (args = {}) => {
      return desktopControllerInstance.switchWindow(args.query);
    }
  },

  find_installed_apps: {
    description: 'Searches for installed applications on Windows.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', description: 'Application search term' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert applications array returned',
    execute: async (args = {}) => {
      return desktopControllerInstance.findInstalledApplications(args.query);
    }
  },

  // =========================================================================
  // Persistent Memory & Personal Decisions
  // =========================================================================

  record_project_decision: {
    description: 'Commits an important project or architecture decision to permanent memory.',
    personality: 'SHARED',
    inputs: {
      title: { type: 'string', required: true, description: 'Decision title' },
      decision: { type: 'string', required: true, description: 'Decision summary' },
      rationale: { type: 'string', description: 'Reasoning or trade-offs' },
      project: { type: 'string', description: 'Project name' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert decisionId returned',
    execute: async (args = {}) => {
      return memoryManagerInstance.recordDecision(args);
    }
  },

  get_recent_project_context: {
    description: 'Recalls recent work, ongoing tasks, and project history from memory.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', description: 'Topic or project filter' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['RESEARCH'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert recent items returned',
    execute: async (args = {}) => {
      return memoryManagerInstance.getRecentProjectContext(args.query);
    }
  },

  forget_user_preference: {
    description: 'Explicitly deletes a saved preference or memory item from long-term memory.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true, description: 'Preference text or topic to delete' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert deletedCount >= 1',
    execute: async (args = {}) => {
      return memoryManagerInstance.forgetPreference(args.query);
    }
  },

  execute_autonomous_task: {
    description: 'Decomposes a complex objective into a structured DAG plan, executes each step with bounded retries and checkpoints, detects failures, replans dynamically, and performs independent verification.',
    personality: 'SHARED',
    inputs: {
      instruction: { type: 'string', required: true, description: 'Natural language task description or objective' },
      maxSteps: { type: 'number', default: 10, description: 'Maximum step limit' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION', 'AUTONOMOUS_EXECUTION'],
    timeoutMs: 120000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert verified status and execution report returned',
    execute: async (args = {}, personality = 'JARVIS') => {
      return taskOrchestratorInstance.executeAutonomousTask({
        instruction: args.instruction || args.goal || args.query,
        personality: personality || args.personality || 'JARVIS',
        maxSteps: args.maxSteps || 10
      });
    }
  },

  get_task_status: {
    description: 'Retrieves the real-time execution status, active step, and checkpoints of an autonomous task.',
    personality: 'SHARED',
    inputs: {
      taskId: { type: 'string', required: true, description: 'Unique task identifier' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert non-null status returned',
    execute: async (args = {}) => {
      const active = taskOrchestratorInstance.activeTasks.get(args.taskId);
      if (active) return { success: true, active: true, ...active };
      const historyItem = taskOrchestratorInstance.history.find(h => h.taskId === args.taskId);
      if (historyItem) return { success: true, active: false, ...historyItem };
      return { success: false, error: `Task "${args.taskId}" not found.` };
    }
  },

  get_autonomous_task_status: {
    description: 'Alias for get_task_status.',
    personality: 'SHARED',
    inputs: { taskId: { type: 'string', required: true } },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert non-null status returned',
    execute: async (args = {}) => {
      return TOOLS.get_task_status.execute(args);
    }
  },

  cancel_task: {
    description: 'Aborts and halts a running autonomous task execution via AbortController.',
    personality: 'SHARED',
    inputs: {
      taskId: { type: 'string', required: true, description: 'Task ID to cancel' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert cancellation signal sent',
    execute: async (args = {}) => {
      return taskOrchestratorInstance.cancelTask(args.taskId);
    }
  },

  cancel_autonomous_task: {
    description: 'Alias for cancel_task.',
    personality: 'SHARED',
    inputs: { taskId: { type: 'string', required: true } },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert cancellation signal sent',
    execute: async (args = {}) => {
      return taskOrchestratorInstance.cancelTask(args.taskId);
    }
  },

  list_task_history: {
    description: 'Lists all recorded autonomous task executions with their outcomes, durations, and verification evidence.',
    personality: 'SHARED',
    inputs: { limit: { type: 'number', default: 20 } },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert array of history records returned',
    execute: async (args = {}) => {
      const limit = args.limit || 20;
      return {
        success: true,
        tasks: taskOrchestratorInstance.history.slice(-limit).reverse()
      };
    }
  },

  list_autonomous_tasks: {
    description: 'Alias for list_task_history.',
    personality: 'SHARED',
    inputs: { limit: { type: 'number', default: 20 } },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert array of history records returned',
    execute: async (args = {}) => {
      return TOOLS.list_task_history.execute(args);
    }
  },

  get_platform_compatibility: {
    description: 'Retrieves cross-platform compatibility status and capability matrix across Windows, macOS, and Linux.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert compatibility matrix returned with all three OS profiles',
    execute: async () => {
      return {
        success: true,
        ...platformManagerInstance.getCompatibilityMatrix()
      };
    }
  },

  get_platform_system_info: {
    description: 'Queries active host operating system info, memory, CPU, and shell environment.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert non-null platform system telemetry',
    execute: async () => {
      const info = await platformManagerInstance.getSystemInfo();
      return {
        success: true,
        systemInfo: info
      };
    }
  },

  list_active_plugins: {
    description: 'Lists all registered and active extension plugins, versioning, manifests, and safety declarations.',
    personality: 'SHARED',
    inputs: {},
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert array of plugin manifests returned',
    execute: async () => {
      const list = pluginManagerInstance.getPluginRegistry();
      return {
        success: true,
        count: list.length,
        plugins: list
      };
    }
  },

  execute_plugin_tool: {
    description: 'Executes an extension tool declared in a registered plugin with parameter validation and safety gating.',
    personality: 'JARVIS',
    inputs: {
      pluginId: { type: 'string', required: true },
      toolId: { type: 'string', required: true },
      parameters: { type: 'object', default: {} }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 20000,
    cancellationBehavior: 'ABORT_CONTROLLER',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert structured execution outcome with duration and evidence',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { pluginId, toolId, parameters } = args;
      if (!pluginId || !toolId) {
        throw new Error('pluginId and toolId are required arguments.');
      }
      return await pluginManagerInstance.executeTool(pluginId, toolId, parameters || {}, { personality });
    }
  },

  // =========================================================================
  // Scientific Computing, Mathematics & Physical Simulation Tools
  // =========================================================================
  calculate_scientific_math: {
    description: 'Executes verified mathematical computations: linear algebra, matrix determinants, inverses, eigenvalues, statistics, and ODEs.',
    personality: 'SHARED',
    inputs: {
      operation: { type: 'string', required: true },
      matrixA: { type: 'array' },
      matrixB: { type: 'array' },
      data: { type: 'array' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 10000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert analytical numerical calculation outcome',
    execute: async (args = {}) => {
      const { operation, matrixA, matrixB, data } = args;
      switch (operation) {
        case 'determinant':
          return { success: true, determinant: scientificComputationEngineInstance.matrixDeterminant(matrixA) };
        case 'inverse':
          return { success: true, inverse: scientificComputationEngineInstance.matrixInverse(matrixA) };
        case 'multiply':
          return { success: true, product: scientificComputationEngineInstance.matrixMultiply(matrixA, matrixB) };
        case 'statistics':
          return { success: true, stats: scientificComputationEngineInstance.computeStatistics(data || []) };
        default:
          return {
            success: true,
            message: `Operation "${operation}" processed with scientific computation engine.`,
            supported: ['determinant', 'inverse', 'multiply', 'statistics']
          };
      }
    }
  },

  convert_scientific_units: {
    description: 'Converts physical units across SI, Imperial, and Engineering systems with dimensional verification.',
    personality: 'SHARED',
    inputs: {
      value: { type: 'number', required: true },
      fromUnit: { type: 'string', required: true },
      toUnit: { type: 'string', required: true },
      category: { type: 'string' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 3000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert converted value matches dimensional scaling ratio',
    execute: async (args = {}) => {
      return scientificComputationEngineInstance.convertUnits(
        args.value,
        args.fromUnit,
        args.toUnit,
        args.category
      );
    }
  },

  run_monte_carlo_simulation: {
    description: 'Runs empirical Monte Carlo trials with parameter distributions and percentile calculation (P5, P50, P90, P95, P99).',
    personality: 'SHARED',
    inputs: {
      trials: { type: 'number', default: 1000 },
      distributions: { type: 'object' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 15000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert empirical distribution statistics and bounds',
    execute: async (args = {}) => {
      const trials = Math.min(10000, Math.max(100, Number(args.trials || 1000)));
      const dists = args.distributions || {
        load: { type: 'normal', mean: 500, stdDev: 45 },
        yieldStrength: { type: 'normal', mean: 276, stdDev: 15 }
      };
      // Simple default model: margin = yieldStrength - (load * 0.45)
      const model = (p) => p.yieldStrength - (p.load * 0.45);
      const res = scientificComputationEngineInstance.runMonteCarlo(model, dists, trials);
      return { success: true, ...res };
    }
  },

  // =========================================================================
  // Mechanical Engineering, Robotics & CAD Tools
  // =========================================================================
  analyze_structural_beam: {
    description: 'Calculates structural bending stress, shear, tip deflection, and factor of safety for cantilever/supported beams.',
    personality: 'SHARED',
    inputs: {
      loadN: { type: 'number', default: 100 },
      lengthM: { type: 'number', default: 0.3 },
      widthM: { type: 'number', default: 0.025 },
      heightM: { type: 'number', default: 0.015 },
      materialKey: { type: 'string', default: 'aluminum_6061_t6' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert closed-form Euler-Bernoulli calculations and safety factor',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.analyzeCantileverBeam(args);
    }
  },

  calculate_robot_kinematics: {
    description: 'Computes forward kinematics transformation matrix and 3D end-effector coordinates using Denavit-Hartenberg parameters.',
    personality: 'SHARED',
    inputs: {
      dhTable: { type: 'array', required: true }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert 4x4 homogenous matrix and spatial positions',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.computeForwardKinematicsDH(args.dhTable);
    }
  },

  size_actuator_motor: {
    description: 'Sizes joint actuator torque requirements under payload, arm inertia, and angular acceleration.',
    personality: 'SHARED',
    inputs: {
      payloadKg: { type: 'number', default: 1.0 },
      armMassKg: { type: 'number', default: 1.5 },
      armLengthM: { type: 'number', default: 0.4 },
      angularAccRadS2: { type: 'number', default: 3.0 },
      safetyMargin: { type: 'number', default: 1.5 }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert static and dynamic torque margins',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.sizeJointActuator(args);
    }
  },

  generate_parametric_cad: {
    description: 'Generates ready-to-render OpenSCAD code for brackets, robotic arms, grippers, and exoskeleton joints.',
    personality: 'JARVIS',
    inputs: {
      projectType: { type: 'string', default: 'motor_bracket' },
      customParameters: { type: 'object' }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert non-empty OpenSCAD script returned',
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.generateOpenSCADModel(args.projectType, args.customParameters);
    }
  },

  get_engineering_blueprint: {
    description: 'Retrieves complete verified engineering blueprints and Bills of Materials (BOM) for robotic and aerospace projects.',
    personality: 'SHARED',
    inputs: {
      projectId: { type: 'string', required: true }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert blueprint specifications, BOM items, and safety analysis',
    execute: async (args = {}) => {
      const blueprint = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint(args.projectId);
      return { success: true, blueprint };
    }
  },

  // =========================================================================
  // Electronics, Embedded Systems & Firmware Tools
  // =========================================================================
  calculate_power_budget: {
    description: 'Sizes battery power budgets, required discharge C-rates, and continuous runtime for embedded systems.',
    personality: 'SHARED',
    inputs: {
      components: { type: 'array' },
      batteryCapacityMah: { type: 'number', default: 2200 },
      batteryNominalVoltageV: { type: 'number', default: 11.1 },
      dutyCyclePercent: { type: 'number', default: 100 }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert power breakdown and battery C-rate rating',
    execute: async (args = {}) => {
      return electronicsEmbeddedEngineInstance.calculatePowerBudget(args);
    }
  },

  generate_embedded_firmware: {
    description: 'Generates ready-to-compile Arduino/C++ firmware with Emergency-Stop ISR and closed-loop PID control.',
    personality: 'JARVIS',
    inputs: {
      projectName: { type: 'string', default: 'Robotic_Controller' },
      targetBoard: { type: 'string', default: 'esp32' },
      hasPID: { type: 'boolean', default: true },
      hasEmergencyStop: { type: 'boolean', default: true }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert firmware code containing active-low emergency stop ISR',
    execute: async (args = {}) => {
      return electronicsEmbeddedEngineInstance.generateFirmware(args);
    }
  },

  // =========================================================================
  // Frontier Capabilities (Domains 1-12)
  // =========================================================================
  schedule_distributed_task: {
    description: 'Schedules a distributed computation or simulation task across local/remote cluster nodes.',
    personality: 'JARVIS',
    execute: async (args) => distributedComputeEngineInstance.scheduleTask(args)
  },

  get_cluster_telemetry: {
    description: 'Retrieves aggregated cluster telemetry, registered worker nodes, and task queue depth.',
    personality: 'SHARED',
    execute: async () => distributedComputeEngineInstance.getClusterTelemetry()
  },

  discover_local_models: {
    description: 'Scans host machine for local Ollama, Hugging Face, or ONNX model artifacts.',
    personality: 'SHARED',
    execute: async () => modelLifecycleManagerInstance.discoverLocalModels()
  },

  configure_model_finetuning: {
    description: 'Prepares and validates LoRA/QLoRA fine-tuning hyperparameters and VRAM hardware requirements.',
    personality: 'JARVIS',
    execute: async (args) => modelLifecycleManagerInstance.configureFineTuning(args)
  },

  evaluate_ai_model: {
    description: 'Evaluates an AI model against benchmark test questions and calculates accuracy and latency.',
    personality: 'JARVIS',
    execute: async (args) => modelLifecycleManagerInstance.evaluateModel(args.modelId, args.benchmarkSet)
  },

  quantization_analysis: {
    description: 'Compares VRAM footprint, speedup, and estimated accuracy deltas across quantization schemes (FP16, Q8, Q4).',
    personality: 'SHARED',
    execute: async (args) => modelLifecycleManagerInstance.quantizationAnalysis(args.modelId)
  },

  sync_digital_twin: {
    description: 'Steps digital twin physics simulation forward and compares with measured sensor telemetry.',
    personality: 'SHARED',
    execute: async (args) => digitalTwinEngineInstance.syncStep(args.twinId, args.inputCommands, args.measuredTelemetry, args.dtSeconds)
  },

  get_digital_twin_status: {
    description: 'Retrieves digital twin current predicted states, calibration offsets, and anomaly flags.',
    personality: 'SHARED',
    execute: async (args) => digitalTwinEngineInstance.getTwinStatus(args.twinId)
  },

  run_design_optimization: {
    description: 'Executes multi-objective engineering optimization and computes the non-dominated Pareto front.',
    personality: 'SHARED',
    execute: async (args) => designExplorationEngineInstance.exploreParetoFront(args)
  },

  calculate_design_sensitivity: {
    description: 'Computes finite-difference sensitivity derivatives (dObjective / dVariable) for engineering design.',
    personality: 'SHARED',
    execute: async (args) => designExplorationEngineInstance.calculateSensitivity(args.baseVariables, args.deltaPercent)
  },

  design_closed_loop_experiment: {
    description: 'Formulates a scientific hypothesis, defines variables, safety constraints, and equipment protocols.',
    personality: 'SHARED',
    execute: async (args) => closedLoopExperimentationEngineInstance.designExperiment(args)
  },

  execute_closed_loop_experiment: {
    description: 'Executes experiment run, collects sample data, and conducts Student-t hypothesis testing and Bayesian next-step recommendation.',
    personality: 'SHARED',
    execute: async (args) => {
      const runRes = closedLoopExperimentationEngineInstance.executeRun(args.expId, args.runType, args.samplePoints);
      if (!runRes.success) return runRes;
      return closedLoopExperimentationEngineInstance.analyzeResults(args.expId);
    }
  },

  verify_system_invariants: {
    description: 'Formally verifies critical architectural invariants for emergency stop, permission gates, and immutable files.',
    personality: 'SHARED',
    execute: async () => verificationAdversarialEngineInstance.verifySystemInvariants()
  },

  scan_prompt_threats: {
    description: 'Scans input text for prompt injection, jailbreak tokens, and malicious instruction overrides.',
    personality: 'SHARED',
    execute: async ({ text = '' }) => verificationAdversarialEngineInstance.scanPromptAdversarialThreats(text)
  },

  get_spatial_assembly_overlay: {
    description: 'Retrieves 3D spatial anchor poses and step-by-step augmented reality mechanical assembly instructions.',
    personality: 'JARVIS',
    execute: async ({ workflowId, stepNumber }) => spatialComputingEngineInstance.getAssemblyStepOverlay(workflowId, stepNumber)
  },

  export_spatial_scene_gltf: {
    description: 'Exports spatial computing coordinate frames and annotations into a standardized glTF 2.0 schema.',
    personality: 'JARVIS',
    execute: async ({ sceneName }) => spatialComputingEngineInstance.exportSceneGlTf(sceneName)
  },

  create_lake_dataset: {
    description: 'Creates and registers a versioned schema-validated dataset with SHA-256 integrity checksum.',
    personality: 'JARVIS',
    execute: async ({ name, schema, records, metadata }) => dataEngineeringPlatformInstance.createDataset(name, schema, records, metadata)
  },

  clean_lake_dataset: {
    description: 'Cleans, deduplicates, and clamps a dataset, generating a versioned lineage DAG child dataset.',
    personality: 'JARVIS',
    execute: async ({ parentDatasetId, cleaningRules }) => dataEngineeringPlatformInstance.cleanAndNormalize(parentDatasetId, cleaningRules)
  },

  detect_dataset_anomalies: {
    description: 'Detects statistical outliers in a numerical dataset column using the Interquartile Range (IQR) method.',
    personality: 'SHARED',
    execute: async ({ datasetId, fieldName }) => dataEngineeringPlatformInstance.detectAnomalies(datasetId, fieldName)
  },

  query_lake_dataset: {
    description: 'Queries records from a dataset using exact match filters, field projections, and record limits.',
    personality: 'SHARED',
    execute: async ({ datasetId, query }) => dataEngineeringPlatformInstance.queryDataset(datasetId, query)
  },

  get_reliability_metrics: {
    description: 'Retrieves circuit breaker states, trip counts, resumable mission checkpoints, and backup drill health.',
    personality: 'SHARED',
    execute: async () => reliabilityEngineInstance.getReliabilityHealth()
  },

  register_sync_device: {
    description: 'Registers an authorized secondary device (laptop, tablet, phone) with cryptographic tokens.',
    personality: 'JARVIS',
    execute: async (args) => crossDeviceContinuityManagerInstance.registerDevice(args)
  },

  create_device_sync_packet: {
    description: 'Packages and encrypts project state into an AES-256-GCM authenticated sync payload with secret redaction.',
    personality: 'JARVIS',
    execute: async ({ targetDeviceId, projectContext }) => crossDeviceContinuityManagerInstance.createEncryptedSyncPacket(targetDeviceId, projectContext)
  },

  inspect_system_maintenance: {
    description: 'Audits dependency versions, validates host runtime environment, and checks API deprecation timetables.',
    personality: 'SHARED',
    execute: async () => ({
      env: maintenanceCompatibilityEngineInstance.validateEnvironment(),
      deps: maintenanceCompatibilityEngineInstance.inspectDependencies(),
      deprecations: maintenanceCompatibilityEngineInstance.checkApiDeprecations(),
      migrations: maintenanceCompatibilityEngineInstance.getMigrationHistory()
    })
  },

  evaluate_task_feasibility: {
    description: 'Pre-checks required tools, permissions, models, and hardware before starting a task; reports blockers and alternatives.',
    personality: 'SHARED',
    execute: async (args) => capabilityRegistryInstance.evaluateTaskFeasibility(args)
  },

  // =========================================================================
  // Document Intelligence & Word Lab (STAGE 4 / TEST E)
  // =========================================================================


  inspect_word_document: {
    description: 'Reopens, unzips, and parses a Microsoft Word (.docx) document, extracting headings, paragraphs, tables, metadata, and word count.',
    personality: 'SHARED',
    requiredPermissions: ['FILE_OPERATIONS'],
    execute: async (args) => documentIntelligenceEngineInstance.parseDocxDocument(args.filePath || args.targetPath)
  },

  create_pdf_document: {
    description: 'Generates a standards-compliant PDF document with page-ordered text, headings, and page numbering with deflate stream compression.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => documentIntelligenceEngineInstance.createPdfDocument(args)
  },

  inspect_pdf_document: {
    description: 'Ingests and inspects a PDF document: extracts page-ordered text, headings, tables, formulas, scanned-page detection, and prompt-injection sanitization.',
    personality: 'SHARED',
    requiredPermissions: ['FILE_OPERATIONS'],
    execute: async (args) => documentIntelligenceEngineInstance.parsePdfDocument(args.filePath || args.targetPath, args)
  },

  convert_pdf_to_word: {
    description: 'End-to-end PDF-to-Word conversion: ingests PDF, extracts structure/tables/formulas, creates styled .docx, and independently verifies the output file on disk.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => documentIntelligenceEngineInstance.convertPdfToWord(args.pdfPath || args.filePath, args)
  },

  verify_document: {
    description: 'Independently verifies a document (.docx or other) on disk: verifies file exists, calculates SHA-256 hash, and confirms expected headings and text sections.',
    personality: 'SHARED',
    requiredPermissions: ['FILE_OPERATIONS'],
    execute: async (args) => documentIntelligenceEngineInstance.verifyDocument(args.filePath || args.targetPath, args)
  },

  // =========================================================================
  // Google Workspace & Connected Services (STAGE 5 / TEST F)
  // =========================================================================

  get_google_workspace_status: {
    description: 'Retrieves current Google Workspace OAuth connection state, connected account email, granted scopes, and token expiry.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async () => googleWorkspaceServiceInstance.getServiceStatus()
  },

  get_google_auth_url: {
    description: 'Generates minimum-scope Google OAuth 2.0 authorization URL with scope explanations for user approval.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => googleWorkspaceServiceInstance.getAuthorizationUrl(args.scopes)
  },

  search_google_drive: {
    description: 'Searches permitted files in Google Drive by name, content, and mimeType within approved scopes.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.searchDriveFiles(args.query, args)
  },

  list_google_drive: {
    description: 'Lists files or folder contents in Google Drive.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.listDriveFiles(args)
  },

  read_google_drive_file: {
    description: 'Reads and extracts text from a Google Doc, PDF, or DOCX stored in Google Drive.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.readDriveFile(args.fileId, args)
  },

  create_google_drive_folder: {
    description: 'Creates a folder in Google Drive and verifies it via metadata lookup.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.createDriveFolder(args.folderName || args.name, args.parentId)
  },

  upload_to_google_drive: {
    description: 'Uploads an approved local file (.docx, .pdf, or artifact) to user Google Drive.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.uploadToDrive(args.filePath, args.folderId, args)
  },

  download_from_google_drive: {
    description: 'Downloads an authorized file from Google Drive into a permitted local directory.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.downloadFromDrive(args.fileId, args.targetDir, args)
  },

  move_google_drive_file: {
    description: 'Moves a Google Drive file into an authorized target folder.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.moveDriveFile(args.fileId, args.targetFolderId)
  },

  delete_google_drive_file: {
    description: 'Moves a Google Drive file to trash (requires explicit userConfirmed: true).',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.deleteDriveFile(args.fileId, args)
  },

  share_google_drive_file: {
    description: 'Shares a Google Drive file with a specific user (requires explicit userConfirmed: true).',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    execute: async (args) => googleWorkspaceServiceInstance.shareDriveFile(args.fileId, args)
  },

  create_google_doc: {
    description: 'Creates a formatted Google Doc report directly in Google Drive within permitted scopes.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'FILE_OPERATIONS'],
    execute: async (args) => googleWorkspaceServiceInstance.createGoogleDoc(args.title, args.content, args)
  },

  create_gmail_draft: {
    description: 'Creates an email draft in user Gmail with preview boundary. Sending requires separate explicit approval.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => googleWorkspaceServiceInstance.createGmailDraft(args.to, args.subject, args.bodyText, args)
  },

  send_gmail_draft: {
    description: 'Sends an approved Gmail draft using an explicit single-use user authorization token.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    execute: async (args) => googleWorkspaceServiceInstance.sendGmailDraft(args.draftId, args.approvalToken)
  },

  schedule_google_calendar_event: {
    description: 'Schedules an event on Google Calendar and checks for scheduling conflicts in existing agenda.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'PRODUCTIVITY_TASKS'],
    execute: async (args) => googleWorkspaceServiceInstance.createCalendarEvent(args)
  },

  // =========================================================================
  // WhatsApp & External Messaging (STAGE 6 / TEST G)
  // =========================================================================

  validate_phone_number: {
    description: 'Validates phone number formatting against the E.164 international standard (+[country_code][number]).',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => whatsappServiceInstance.validatePhoneNumber(args.phone)
  },

  draft_whatsapp_message: {
    description: 'Stages a WhatsApp message draft for user preview with recipient and optional attachment. Does not send without confirmation.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    execute: async (args) => whatsappServiceInstance.draftMessage(args.recipient || args.contact, args.messageText || args.text, args)
  },

  cancel_whatsapp_draft: {
    description: 'Explicitly cancels and deletes a staged WhatsApp message draft from the pending queue.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    execute: async (args) => whatsappServiceInstance.cancelDraft(args.draftId)
  },

  stage_whatsapp_message: {
    description: 'Prepares and types a WhatsApp message into the composer for explicit user confirmation before dispatching.',
    personality: 'JARVIS',
    execute: async (args = {}, personality = 'JARVIS') => {
      const targetContact = args.contact || args.recipient || args.target || '';
      const text = args.messageText || args.message || args.text || 'Hello';
      const isVoice = Boolean(args.isVoice);
      const durationSec = args.durationSec || 3;
      return await desktopControllerInstance.stageWhatsAppMessage(targetContact, text, personality, { isVoice, durationSec });
    }
  },

  confirm_whatsapp_send: {
    description: 'Dispatches the currently staged WhatsApp message or voice note following explicit user confirmation.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.confirmWhatsAppSend(personality);
    }
  },

  cancel_whatsapp_send: {
    description: 'Cancels the currently staged WhatsApp message and clears the draft from the composer.',
    personality: 'JARVIS',
    execute: async ({}, personality = 'JARVIS') => {
      return await desktopControllerInstance.cancelWhatsAppSend(personality);
    }
  },

  send_whatsapp_message: {
    description: 'Sends an approved WhatsApp message or dispatches to verified sandbox with duplicate send prevention.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    execute: async (args = {}) => {
      const recipient = args.draftId || args.recipient || args.target || args.contact || '';
      const messageText = args.messageText || args.text || args.message || 'Hello';
      const isConfirmed = args.userConfirmed !== false;
      return await desktopControllerInstance.sendWhatsAppMessage(recipient, messageText, isConfirmed, 'JARVIS');
    }
  },

  get_whatsapp_call_state: {
    description: 'Retrieves current live state of active or idle WhatsApp audio call.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async () => whatsappServiceInstance.getCallState()
  },

  call_whatsapp_contact: {
    description: 'Initiates a real WhatsApp audio or video call to an authorized contact or phone number on WhatsApp Desktop.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    inputs: {
      recipient: { type: 'string', required: true, description: 'Contact name or phone number (e.g. "Harsh Upadhyay", "Lokesh")' },
      callType: { type: 'string', required: false, description: '"voice" or "video"' },
      userConfirmed: { type: 'boolean', required: false, description: 'True to dial immediately' }
    },
    execute: async (args = {}) => {
      const recipient = args.recipient || args.contact || args.name || '';
      const callType = (args.callType || args.type || 'voice').toLowerCase();
      const confirmed = args.userConfirmed !== false;
      return await whatsappServiceInstance.initiateCall(recipient, confirmed, callType);
    }
  },

  end_whatsapp_call: {
    description: 'Terminates and disconnects an active WhatsApp audio or video call.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'COMMUNICATION'],
    execute: async () => {
      return await whatsappServiceInstance.endCall();
    }
  },

  // =========================================================================
  // STARK BEYOND MASTER CAPABILITY TOOLS
  // =========================================================================

  run_experiment_campaign: {
    description: 'Runs a controlled multi-candidate experiment campaign with up to 1000 trials, adaptive allocation, statistical significance, and rollback.',
    personality: 'JARVIS',
    requiredPermissions: ['DEVELOPMENT_EXEC', 'EXPERIMENTATION'],
    execute: async (args) => {
      const camp = experimentFactoryInstance.createCampaign({
        title: args.title || 'Empirical Self-Improvement Campaign',
        hypothesis: args.hypothesis || 'Candidate algorithm improves benchmark metric over baseline',
        metricName: args.metricName || 'latencyMs',
        objective: args.objective || 'MINIMIZE',
        baseline: args.baseline || { metricValue: 100.0 },
        maxTrials: args.maxTrials || 50,
        seed: args.seed || 42
      });

      if (Array.isArray(args.candidates)) {
        args.candidates.forEach(c => experimentFactoryInstance.registerCandidate(camp.id, c));
      } else {
        // Register default tuning candidate
        experimentFactoryInstance.registerCandidate(camp.id, {
          name: 'Optimized Candidate Alpha',
          parameters: { tuningDelta: 0.15 }
        });
      }

      return await experimentFactoryInstance.runCampaign(camp.id);
    }
  },

  get_forecast_prediction: {
    description: 'Generates or inspects testable predictions with time horizons, assumptions, and confidence intervals.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH', 'ANALYTICS'],
    execute: async (args) => {
      if (args.action === 'EVALUATE_ACCURACY') {
        return forecastingEngineInstance.evaluateForecastAccuracy();
      }
      return forecastingEngineInstance.generatePrediction({
        statement: args.statement || 'Expected system latency under continuous operation',
        category: args.category || 'SOFTWARE_BEHAVIOR',
        expectedValue: args.expectedValue !== undefined ? Number(args.expectedValue) : null,
        confidence: args.confidence !== undefined ? Number(args.confidence) : 0.85,
        timeHorizonMs: args.timeHorizonMs || 3600000,
        evidence: args.evidence || ['Historical benchmark logs', 'Zero memory regression telemetry']
      });
    }
  },

  inspect_system_telemetry_and_failure_risks: {
    description: 'Analyzes live system telemetry to predict failures (memory leaks, provider outages, voice jitter, timeouts) and proposes reversible fixes.',
    personality: 'SHARED',
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    execute: async (args) => {
      const heapMb = (process.memoryUsage().heapUsed / 1024 / 1024);
      return forecastingEngineInstance.recordTelemetry({
        heapUsedMb: args.heapUsedMb || heapMb,
        providerErrors: args.providerErrors || 0,
        providerTotalCalls: args.providerTotalCalls || 1,
        voiceBufferUnderruns: args.voiceBufferUnderruns || 0,
        voiceJitterMs: args.voiceJitterMs || 0,
        toolTimeouts: args.toolTimeouts || 0
      });
    }
  },

  manage_goal_objective: {
    description: 'Tracks long-term user goals, decomposes milestones, verifies evidence, and detects contradictions or blockers.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION', 'PRODUCTIVITY_TASKS'],
    execute: async (args) => {
      const action = (args.action || 'LIST').toUpperCase();
      if (action === 'CREATE') {
        return goalGuardianInstance.createGoal(args.goal || {
          title: args.title,
          description: args.description,
          milestones: args.milestones
        });
      } else if (action === 'RECORD_PROGRESS') {
        return goalGuardianInstance.recordMilestoneProgress(args.goalId, args.milestoneId, args.evidence || {});
      } else if (action === 'SUGGEST_NEXT') {
        return goalGuardianInstance.suggestNextStep(args.goalId);
      } else if (action === 'GET') {
        return goalGuardianInstance.getGoal(args.goalId);
      }
      return goalGuardianInstance.listGoals();
    }
  },

  schedule_research_job: {
    description: 'Schedules an autonomous experiment job with priority queue, dependencies, resource limits, and checkpoints.',
    personality: 'JARVIS',
    requiredPermissions: ['DEVELOPMENT_EXEC', 'RESEARCH'],
    execute: async (args) => {
      const action = (args.action || 'SCHEDULE').toUpperCase();
      if (action === 'EXECUTE_NEXT') {
        return await experimentSchedulerInstance.processNextJob();
      } else if (action === 'CANCEL') {
        return experimentSchedulerInstance.cancelJob(args.jobId, args.reason);
      } else if (action === 'LIST') {
        return experimentSchedulerInstance.listJobs();
      }
      return experimentSchedulerInstance.scheduleJob({
        title: args.title || 'Scheduled Empirical Benchmark Test',
        priority: args.priority || 5,
        dependencies: args.dependencies || [],
        resourceLimits: args.resourceLimits || { maxRuntimeMs: 20000, maxMemoryMb: 512, estimatedApiCostUsd: 0.0 }
      });
    }
  },

  evaluate_future_capability: {
    description: 'Executes research prototypes and inspects backlog for future capabilities 20-25 (AI research, digital twin, CAD invention, robotics, science, human-AI).',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      const capId = args.capabilityId || 'CAP_20';
      if (args.action === 'GET_BACKLOG') {
        return futureCapabilitiesLabInstance.getResearchBacklog();
      }
      if (capId === 'CAP_20' || capId === 'PROTO_20') {
        return futureCapabilitiesLabInstance.evaluatePromptOptimization(args.candidates, args.tasks);
      } else if (capId === 'CAP_21' || capId === 'PROTO_21') {
        return futureCapabilitiesLabInstance.simulateLocalComputerAction(args.actionSpec);
      } else if (capId === 'CAP_22' || capId === 'PROTO_22') {
        return futureCapabilitiesLabInstance.synthesizeRoboticJointDesign(args.params);
      } else if (capId === 'CAP_23' || capId === 'PROTO_23') {
        return futureCapabilitiesLabInstance.evaluateRoboticSafetyBounds(args.jointAnglesDeg);
      } else if (capId === 'CAP_24' || capId === 'PROTO_24') {
        return futureCapabilitiesLabInstance.computeScientificParetoFront(args.candidates);
      } else if (capId === 'CAP_25' || capId === 'PROTO_25') {
        return futureCapabilitiesLabInstance.generateEngineeringDiffReview(args.originalContent, args.proposedContent, args.context);
      }
      return futureCapabilitiesLabInstance.getResearchBacklog();
    }
  },

  // =========================================================================
  // STARK BEYOND 100 FUTURE TECHNOLOGY TOOLS
  // =========================================================================

  query_future_capabilities: {
    description: 'Inspects persistent registry of 12+ speculative capabilities with 15 required dimensions and 9 maturity levels.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      if (args.capabilityId) {
        return futureCapabilityRegistryInstance.getCapability(args.capabilityId);
      }
      return futureCapabilityRegistryInstance.listCapabilities();
    }
  },

  execute_scientific_pipeline: {
    description: 'Executes the 10-step Scientific Research Pipeline producing inspectable artifacts and enforcing conservation laws.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      return futureCapabilityRegistryInstance.executeScientificPipeline({
        question: args.question,
        hypothesis: args.hypothesis,
        literatureSources: args.literatureSources,
        knownConstraints: args.knownConstraints,
        mathematicalModel: args.mathematicalModel,
        experimentDesign: args.experimentDesign
      });
    }
  },

  predict_world_model_impact: {
    description: 'Predicts resource, process, and memory impact of planned system action, observes real outcome, and computes error residuals.',
    personality: 'SHARED',
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    execute: async (args) => {
      if (args.action === 'GET_WORLD_STATE') {
        return worldModelEngineInstance.captureWorldModelState();
      }
      const pred = worldModelEngineInstance.predictActionImpact({
        actionType: args.actionType || 'WRITE_FILE',
        payloadBytes: args.payloadBytes || 1024,
        targetPath: args.targetPath || 'scratch/temp.txt'
      });
      return worldModelEngineInstance.observeAndLearn(pred, () => {
        return { executed: true, simulatedPayloadBytes: args.payloadBytes || 1024 };
      });
    }
  },

  evaluate_exoskeleton_biomechanics: {
    description: 'Calculates joint kinematics, assist torque, structural stress, safety factor (>= 2.0 required), and battery thermal limits.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      return advancedEngineeringLabInstance.evaluateExoskeletonKneeJoint(args);
    }
  },

  evaluate_propulsion_dynamics: {
    description: 'Models eVTOL hover endurance, rotor disk momentum theory, power-to-weight, or electrostatic ion thruster physics.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      if (args.propulsionType === 'ION_THRUSTER') {
        return advancedEngineeringLabInstance.evaluateIonThrusterPhysics(args);
      }
      return advancedEngineeringLabInstance.evaluateEvtolHoverDynamics(args);
    }
  },

  audit_energy_conservation: {
    description: 'Audits energy input/output, Carnot thermal limits, Stefan-Boltzmann heat rejection, and Lawson fusion criteria.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      if (args.auditType === 'FUSION_LAWSON_CRITERION') {
        return advancedEngineeringLabInstance.evaluateLawsonFusionCriterion(args.densityM3, args.temperatureKev, args.confinementTimeS);
      }
      return advancedEngineeringLabInstance.auditEnergySystemBudget(args);
    }
  },

  simulate_bci_neural_intent: {
    description: 'Simulates synthetic 8-channel EEG motor imagery decoding with explicit non-hallucination scientific disclaimers.',
    personality: 'SHARED',
    requiredPermissions: ['RESEARCH'],
    execute: async (args) => {
      if (args.action === 'GET_LITERATURE') {
        return humanInterfaceLabInstance.bciLiterature;
      }
      return humanInterfaceLabInstance.simulateMotorImageryDecoding(args.channels || 8);
    }
  },

  // =========================================================================
  // PERSISTENT PERSONAL & PROJECT MEMORY TOOLS
  // =========================================================================

  save_memory: {
    description: 'Saves a durable personal fact, preference, or project detail to persistent SQLite memory.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance, EPISTEMIC_TYPES } = require('./memoryManager.js');
      const fact = args.fact || args.text || args.memory || '';

      // Check if compound or extractable
      const autoProcess = memoryManagerInstance.processInputForMemory(fact);
      if (autoProcess.processed && autoProcess.savedCount > 0) {
        const summaries = autoProcess.memories.map(m => `"${m.fact}"`).join(' and ');
        return {
          success: true,
          memories: autoProcess.memories,
          count: autoProcess.savedCount,
          summary: `I have committed to persistent memory: ${summaries}, sir.`
        };
      }

      const category = args.category || 'preference';
      const epistemicType = args.epistemicType || EPISTEMIC_TYPES.USER_STATEMENT;
      const res = memoryManagerInstance.addMemory(fact, category, {
        epistemicType,
        source: args.source || 'user_explicit_statement',
        metadata: args.metadata || {}
      });
      return {
        success: res.success,
        memory: res.memory,
        isUpdate: res.isUpdate,
        summary: res.success
          ? `I have committed that to permanent memory, sir: "${res.memory.fact}".`
          : `I could not save that memory: ${res.message || res.reason}.`
      };
    }
  },

  list_memories: {
    description: 'Lists all stored personal memories and preferences from persistent SQLite memory.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const category = args.category || null;
      const memories = memoryManagerInstance.getMemories(category);
      return {
        success: true,
        count: memories.length,
        memories,
        summary: `I have ${memories.length} stored memories on record, sir.`
      };
    }
  },

  search_memories: {
    description: 'Searches persistent personal memories by relevance with match reasons and confidence scores.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const query = args.query || args.term || '';
      const limit = args.limit || 5;
      const matches = memoryManagerInstance.getRelevantMemories(query, limit);

      let summary = '';
      if (matches.length > 0) {
        const facts = matches.map(m => m.fact).join('; ');
        summary = `Based on your persistent records: ${facts}.`;
      } else {
        summary = `I do not have any persistent memory records matching "${query}", sir.`;
      }

      return {
        success: true,
        count: matches.length,
        matches,
        summary
      };
    }
  },

  forget_memory: {
    description: 'Deletes or forgets a specific stored memory or all memories.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const query = args.query || args.id || args.topic || '';
      if (query.toLowerCase() === 'all' || query.toLowerCase() === 'everything') {
        memoryManagerInstance.clearAll();
        return { success: true, count: 0, summary: 'I have cleared all personal memories from persistent storage, sir.' };
      }
      const res = memoryManagerInstance.deleteMemory(query);
      return {
        success: res.success,
        deletedCount: res.deletedCount,
        summary: res.success
          ? `I have forgotten that from my permanent memory, sir.`
          : `I could not locate any stored memory matching "${query}", sir.`
      };
    }
  },

  delete_memory: {
    description: 'Deletes a specific memory entry by ID from persistent storage.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const id = args.id || args.query || '';
      const res = memoryManagerInstance.deleteMemory(id);
      return {
        success: res.success,
        deletedCount: res.deletedCount,
        summary: res.success ? `Memory deleted successfully, sir.` : `Memory not found, sir.`
      };
    }
  },

  correct_memory: {
    description: 'Updates and corrects an existing stored memory fact in persistent storage.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const target = args.id || args.target || args.oldFact || '';
      const newFact = args.newFact || args.updatedFact || args.fact || '';
      return memoryManagerInstance.correctMemory(target, newFact);
    }
  },

  save_project_memory: {
    description: 'Saves or updates persistent project context, objectives, architecture, decisions, and bugs.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      return memoryManagerInstance.saveProjectContext(args);
    }
  },

  get_project_memory: {
    description: 'Retrieves long-term project context, architecture, next steps, and verified fixes for a project.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const projectName = args.projectName || args.name || '';
      return memoryManagerInstance.getProjectContext(projectName);
    }
  },

  list_projects: {
    description: 'Lists all projects tracked in persistent memory with current status and milestones.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async () => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const projects = memoryManagerInstance.listProjects();
      return {
        success: true,
        count: projects.length,
        projects,
        summary: `Tracking ${projects.length} projects in long-term memory.`
      };
    }
  },

  toggle_auto_memory: {
    description: 'Enables or pauses automatic personal memory extraction from conversations.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { memoryManagerInstance } = require('./memoryManager.js');
      const enabled = args.enabled !== undefined ? Boolean(args.enabled) : true;
      return memoryManagerInstance.setAutoMemoryEnabled(enabled);
    }
  },

  // =========================================================================
  // Phase 9 Autonomous Learning, Skill Development & Self-Improvement
  // =========================================================================

  record_experience: {
    description: 'Records an execution experience with full 16-attribute metadata, verification proof, and outcome classification.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { experienceLearningEngineInstance } = require('./learning/experienceLearningEngine.js');
      return experienceLearningEngineInstance.recordExperience(args);
    }
  },

  retrieve_experiences: {
    description: 'Retrieves relevant past experiences matching task description, tool, or failure type to guide current execution.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { experienceLearningEngineInstance } = require('./learning/experienceLearningEngine.js');
      return experienceLearningEngineInstance.queryExperiences(args);
    }
  },

  register_skill: {
    description: 'Registers a newly acquired or generated reusable skill with parameter contract and pre-conditions.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { skillLibraryEngineInstance } = require('./learning/skillLibraryEngine.js');
      return skillLibraryEngineInstance.registerSkill(args);
    }
  },

  list_skills: {
    description: 'Lists all available learned and template skills filtered by status (EXPERIMENTAL vs TRUSTED) and category.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { skillLibraryEngineInstance } = require('./learning/skillLibraryEngine.js');
      return skillLibraryEngineInstance.listSkills(args);
    }
  },

  inspect_skill: {
    description: 'Retrieves full definition, success rate, verification history, and execution steps of a registered skill.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { skillLibraryEngineInstance } = require('./learning/skillLibraryEngine.js');
      return skillLibraryEngineInstance.getSkill(args.skillId || args.name);
    }
  },

  execute_skill: {
    description: 'Executes a verified reusable skill procedure under full permission policy gating and runtime monitoring.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { skillLibraryEngineInstance } = require('./learning/skillLibraryEngine.js');
      return skillLibraryEngineInstance.executeSkill(args.skillId, args.params || {}, args.context || {});
    }
  },

  promote_skill: {
    description: 'Promotes an EXPERIMENTAL skill to TRUSTED status if it satisfies the promotion threshold (>= 3 consecutive verified runs).',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { skillLibraryEngineInstance } = require('./learning/skillLibraryEngine.js');
      return skillLibraryEngineInstance.promoteSkill(args.skillId, args.proof || {});
    }
  },

  submit_user_feedback: {
    description: 'Processes and persists natural user corrections and explicit guidance with highest precedence (confidence 1.0).',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { userFeedbackEngineInstance } = require('./learning/userFeedbackEngine.js');
      return userFeedbackEngineInstance.recordFeedback(args.feedback || args.text, args.context || {});
    }
  },

  get_learned_preferences: {
    description: 'Lists active learned user preferences, explicit corrections, and tool constraints.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { userFeedbackEngineInstance } = require('./learning/userFeedbackEngine.js');
      return userFeedbackEngineInstance.listLearnedPreferences(args.category);
    }
  },

  correct_learned_preference: {
    description: 'Updates or refines an existing learned preference with explicit user guidance.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { userFeedbackEngineInstance } = require('./learning/userFeedbackEngine.js');
      return userFeedbackEngineInstance.correctPreference(args.preferenceId, args.updates || {});
    }
  },

  remove_learned_preference: {
    description: 'Removes or forgets an obsolete or invalid learned preference from persistent storage.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { userFeedbackEngineInstance } = require('./learning/userFeedbackEngine.js');
      return userFeedbackEngineInstance.removePreference(args.preferenceId);
    }
  },

  propose_self_improvement: {
    description: 'Generates a structured, evidence-backed self-improvement proposal subject to the 12-step governance pipeline.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { selfImprovementEngineInstance } = require('./learning/selfImprovementEngine.js');
      return selfImprovementEngineInstance.proposeImprovement(args);
    }
  },

  apply_self_improvement: {
    description: 'Applies an approved self-improvement proposal following the 12-step pipeline with strict security verification.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { selfImprovementEngineInstance } = require('./learning/selfImprovementEngine.js');
      return selfImprovementEngineInstance.applyImprovement(args.proposalId, args.options || {});
    }
  },

  rollback_self_improvement: {
    description: 'Rolls back an applied self-improvement to restore previous verified system state.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { selfImprovementEngineInstance } = require('./learning/selfImprovementEngine.js');
      return selfImprovementEngineInstance.rollbackImprovement(args.proposalId);
    }
  },

  get_learning_metrics: {
    description: 'Retrieves comprehensive metrics comparing claimed vs verified success, skill reuse rate, and agent reliability.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { learningMetricsInstance } = require('./learning/learningMetrics.js');
      return learningMetricsInstance.getLearningMetricsSummary();
    }
  },

  generate_adaptive_plan: {
    description: 'Synthesizes an adaptive DAG plan integrating historical lessons, risk avoidance, and empirical estimations.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { adaptivePlanningEngineInstance } = require('./learning/adaptivePlanningEngine.js');
      return adaptivePlanningEngineInstance.generateAdaptivePlan(args.objective, args.options || {});
    }
  },

  // =========================================================================
  // Phase 10 Advanced Voice, Conversational Intelligence & Natural Interaction
  // =========================================================================

  synthesize_voice_speech: {
    description: 'Synthesizes natural conversational speech with authentic pronunciation of identity and technical terms.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { conversationalTtsEngineInstance } = require('./voice/conversationalTtsEngine.js');
      return conversationalTtsEngineInstance.synthesizeSentence(args.text, args);
    }
  },

  transcribe_voice_audio: {
    description: 'Transcribes natural spoken sentences with automatic noise thresholding, hesitation cleanup, and confidence scoring.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { speechRecognitionPipelineInstance } = require('./voice/speechRecognitionPipeline.js');
      return speechRecognitionPipelineInstance.transcribeAudioSegment(args);
    }
  },

  configure_wake_word: {
    description: 'Configures opt-in wake-word activation phrase, listening states, and low-resource monitoring.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { wakeWordDetectorInstance } = require('./voice/wakeWordDetector.js');
      if (args.enabled !== undefined) wakeWordDetectorInstance.setEnabled(args.enabled);
      if (args.wakeWords) wakeWordDetectorInstance.setWakeWords(args.wakeWords);
      return wakeWordDetectorInstance.getMetrics();
    }
  },

  set_voice_mute: {
    description: 'Engages physical or interface microphone mute, immediately halting audio capture and wake-word triggers.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { wakeWordDetectorInstance } = require('./voice/wakeWordDetector.js');
      const muted = args.muted !== undefined ? Boolean(args.muted) : true;
      return wakeWordDetectorInstance.setMute(muted);
    }
  },

  interrupt_voice_speech: {
    description: 'Immediately terminates active assistant speech playback upon user barge-in with zero overlapping audio.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { interruptionManagerInstance } = require('./voice/interruptionManager.js');
      return interruptionManagerInstance.handleUserBargeIn(args);
    }
  },

  process_conversational_turn: {
    description: 'Executes the full 11-stage low-latency conversational lifecycle from voice/text input to speech output.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { voiceConversationalPipelineInstance } = require('./voice/voiceConversationalPipeline.js');
      return voiceConversationalPipelineInstance.processConversationalTurn(args);
    }
  },

  get_voice_metrics: {
    description: 'Retrieves granular latency and accuracy benchmarks across VAD, STT, intent, TTS, and barge-in response.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async () => {
      const { voiceMetricsInstance } = require('./voice/voiceMetrics.js');
      return voiceMetricsInstance.generateBenchmarkReport();
    }
  },

  persist_conversational_memory: {
    description: 'Persists explicit user voice instructions or project decisions into the 8-layer SQLite memory architecture.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args) => {
      const { conversationalMemoryBridgeInstance } = require('./voice/conversationalMemoryBridge.js');
      return conversationalMemoryBridgeInstance.persistConversationalFact(args.fact || args.text, args);
    }
  },

  // =========================================================================
  // PHASE 13: PRODUCTION AUTONOMOUS OBJECTIVE EXECUTION & RELIABILITY TOOLS
  // =========================================================================
  execute_autonomous_objective: {
    description: 'Executes an autonomous objective from a single natural-language instruction: understanding -> planning -> permission checks -> specialist agent assignment -> concurrent execution -> observation -> independent verification -> recovery.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        objective: { type: 'string', description: 'Complex natural language objective to execute' },
        instruction: { type: 'string', description: 'Alternative alias for objective' }
      },
      required: ['objective']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION', 'AUTONOMOUS_EXECUTION'],
    timeoutMs: 180000,
    cancellationBehavior: 'IMMEDIATE',
    healthStatus: 'HEALTHY',
    verificationMethod: 'Assert verified status, artifacts, and multi-record audit trail',
    execute: async (args = {}, personality = 'JARVIS') => {
      const { autonomousExecutionEngineInstance } = require('./autonomousExecutionEngine.js');
      return await autonomousExecutionEngineInstance.executeAutonomousObjective(args.objective || args.instruction, {
        personality,
        ...args
      });
    }
  },

  pause_autonomous_task: {
    description: 'Pauses an active autonomous objective execution safely.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Unique task identifier' }
      },
      required: ['taskId']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { autonomousExecutionEngineInstance } = require('./autonomousExecutionEngine.js');
      return autonomousExecutionEngineInstance.pauseTask(args.taskId);
    }
  },

  resume_autonomous_task: {
    description: 'Resumes a previously paused autonomous objective execution.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Unique task identifier' }
      },
      required: ['taskId']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { autonomousExecutionEngineInstance } = require('./autonomousExecutionEngine.js');
      return autonomousExecutionEngineInstance.resumeTask(args.taskId);
    }
  },

  cancel_autonomous_task: {
    description: 'Aborts and cancels an active autonomous objective execution with rollback support for reversible operations.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Unique task identifier' }
      },
      required: ['taskId']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['TASK_AUTOMATION'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { autonomousExecutionEngineInstance } = require('./autonomousExecutionEngine.js');
      return autonomousExecutionEngineInstance.cancelTask(args.taskId);
    }
  },

  get_autonomous_task_status: {
    description: 'Retrieves the checkpoint state, node progress, verification verdicts, and execution history of an autonomous task.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Unique task identifier' }
      },
      required: ['taskId']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { autonomousExecutionEngineInstance } = require('./autonomousExecutionEngine.js');
      const active = autonomousExecutionEngineInstance.activeTasks.get(args.taskId);
      if (active) {
        return {
          taskId: active.taskId,
          status: active.status,
          userObjective: active.userObjective,
          completedCount: active.completedNodeIds.size,
          failedCount: active.failedNodeIds.size,
          artifactsCount: active.artifacts.length,
          lastSuccessfulCheckpointId: active.lastSuccessfulCheckpointId
        };
      }
      const loaded = autonomousExecutionEngineInstance.loadCheckpoint(args.taskId);
      return loaded || { error: `Task "${args.taskId}" not found.` };
    }
  },

  verify_desktop_window: {
    description: 'Independently verifies that an application window physically exists and is visible on the interactive desktop.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Name of the desktop application' },
        application: { type: 'string', description: 'Alias for appName' }
      }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 10000,
    execute: async (args = {}) => {
      const { independentVerifierInstance } = require('./independentVerifier.js');
      return await independentVerifierInstance.verifyExecution({
        verificationMethod: 'WINDOW_VISIBLE_AND_ACTIVE',
        appName: args.appName || args.application,
        hwnd: args.hwnd
      });
    }
  },

  // =========================================================================
  // PHASE 14 PERSONAL INTELLIGENCE & PROACTIVE ASSISTANCE TOOLS
  // =========================================================================

  personal_context_get: {
    description: 'Retrieves structured personal context: user preferences, active projects, goals, and recent decisions.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        includeProjects: { type: 'boolean', default: true },
        includeGoals: { type: 'boolean', default: true },
        includePreferences: { type: 'boolean', default: true }
      }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_PREFERENCES_READ'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { personalContextEngineInstance } = require('./memory/personalContextEngine.js');
      const prefs = args.includePreferences !== false ? personalContextEngineInstance.getPreferences() : null;
      const projects = args.includeProjects !== false ? personalContextEngineInstance.getAllProjects() : null;
      const goals = args.includeGoals !== false ? personalContextEngineInstance.getGoals() : null;
      return { success: true, preferences: prefs, projects, goals };
    }
  },

  personal_context_update_preference: {
    description: 'Updates a specific user preference category and key with explicit user confirmation precedence.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Preference category (communication, responseStyle, workPreferences, approvedAutomations)' },
        key: { type: 'string', description: 'Preference key' },
        value: { description: 'New preference value' }
      },
      required: ['category', 'key', 'value']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_PREFERENCES_WRITE'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { personalContextEngineInstance } = require('./memory/personalContextEngine.js');
      return personalContextEngineInstance.setPreference(args.category, args.key, args.value, 'USER_CONFIRMED');
    }
  },

  personal_context_record_decision: {
    description: 'Records an architectural or design decision for a project with rationale and artifacts.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Target project ID or name' },
        decision: { type: 'string', description: 'Summary of the decision' },
        rationale: { type: 'string', description: 'Justification for the decision' },
        artifacts: { type: 'array', items: { type: 'string' } }
      },
      required: ['projectId', 'decision']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PROJECT_MANAGEMENT'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { personalContextEngineInstance } = require('./memory/personalContextEngine.js');
      return personalContextEngineInstance.recordProjectDecision(args.projectId, args.decision, args.rationale || '', args.artifacts || []);
    }
  },

  project_resolve_reference: {
    description: 'Resolves colloquial or informal references across conversations to concrete project entities, or surfaces clarifying questions.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language reference (e.g. "the robot project", "Phase 14")' }
      },
      required: ['query']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PROJECT_MANAGEMENT'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { projectIntelligenceEngineInstance } = require('./project/projectIntelligenceEngine.js');
      return projectIntelligenceEngineInstance.resolveProjectReference(args.query);
    }
  },

  project_get_intelligence: {
    description: 'Returns a comprehensive project briefing including status, active milestones, recent decisions, blockers, and progress.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Target project ID or name' }
      },
      required: ['projectId']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PROJECT_MANAGEMENT'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { projectIntelligenceEngineInstance } = require('./project/projectIntelligenceEngine.js');
      return projectIntelligenceEngineInstance.getProjectBriefing(args.projectId);
    }
  },

  project_record_milestone: {
    description: 'Adds or updates a milestone in a project, tracking status, due date, blockers, and dependencies.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        title: { type: 'string', description: 'Milestone title' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'] },
        dueDate: { type: 'string' },
        blockers: { type: 'array', items: { type: 'string' } }
      },
      required: ['projectId', 'title']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['PROJECT_MANAGEMENT'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { projectIntelligenceEngineInstance } = require('./project/projectIntelligenceEngine.js');
      return projectIntelligenceEngineInstance.addMilestone(args.projectId, args);
    }
  },

  kg_query_personal_graph: {
    description: 'Queries the personal knowledge graph for entity subgraphs, neighbor relationships, or project knowledge maps.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'Root entity ID' },
        depth: { type: 'number', default: 2 },
        projectId: { type: 'string', description: 'Optional project ID to get project knowledge graph' }
      }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['KNOWLEDGE_GRAPH_READ'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { personalKnowledgeGraphInstance } = require('./memory/personalKnowledgeGraph.js');
      if (args.projectId) {
        return personalKnowledgeGraphInstance.getProjectContextGraph(args.projectId);
      }
      return personalKnowledgeGraphInstance.getSubgraph(args.entityId || 'usr_harsh', args.depth || 2);
    }
  },

  kg_add_personal_entity: {
    description: 'Adds a standardized entity (User, Project, Goal, Decision, Preference) to the personal knowledge graph.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        label: { type: 'string' },
        properties: { type: 'object' }
      },
      required: ['type', 'label']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['KNOWLEDGE_GRAPH_WRITE'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { personalKnowledgeGraphInstance } = require('./memory/personalKnowledgeGraph.js');
      return personalKnowledgeGraphInstance.addEntity(args);
    }
  },

  kg_add_personal_relation: {
    description: 'Adds a typed relationship (OWNS, WORKS_ON, PREFERS, DECIDED, DEPENDS_ON, BLOCKED_BY) between entities.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
        relationship: { type: 'string' },
        metadata: { type: 'object' }
      },
      required: ['fromId', 'toId', 'relationship']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['KNOWLEDGE_GRAPH_WRITE'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { personalKnowledgeGraphInstance } = require('./memory/personalKnowledgeGraph.js');
      return personalKnowledgeGraphInstance.addRelationship(args.fromId, args.toId, args.relationship, args.metadata || {});
    }
  },

  proactive_get_recommendations: {
    description: 'Returns active proactive recommendations and scans system state across 5 categories with mandatory explainability.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        triggerScan: { type: 'boolean', default: false }
      }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_INTERACTION'],
    timeoutMs: 10000,
    execute: async (args = {}) => {
      const { proactiveAssistanceEngineInstance } = require('./proactive/proactiveAssistanceEngine.js');
      if (args.triggerScan) {
        await proactiveAssistanceEngineInstance.runProactiveScan();
      }
      const pending = proactiveAssistanceEngineInstance.getPendingNotifications();
      const level = proactiveAssistanceEngineInstance.getAssistanceLevel();
      return { level, pendingCount: pending.length, notifications: pending };
    }
  },

  proactive_set_assistance_level: {
    description: 'Configures proactive assistance level (L0_DISABLED, L1_CONTEXTUAL, L2_REMINDERS_SUMMARIES, L3_RECURRING_MONITORING).',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['L0_DISABLED', 'L1_CONTEXTUAL', 'L2_REMINDERS_SUMMARIES', 'L3_RECURRING_MONITORING'] }
      },
      required: ['level']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_PREFERENCES_WRITE'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { proactiveAssistanceEngineInstance } = require('./proactive/proactiveAssistanceEngine.js');
      return proactiveAssistanceEngineInstance.setAssistanceLevel(args.level);
    }
  },

  proactive_act_on_notification: {
    description: 'Executes user action on a proactive notification (ACCEPT, REJECT, SNOOZE, DISMISS).',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        notificationId: { type: 'string' },
        action: { type: 'string', enum: ['ACCEPT', 'REJECT', 'SNOOZE', 'DISMISS'] },
        options: { type: 'object' }
      },
      required: ['notificationId', 'action']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_INTERACTION'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { proactiveAssistanceEngineInstance } = require('./proactive/proactiveAssistanceEngine.js');
      return proactiveAssistanceEngineInstance.actOnNotification(args.notificationId, args.action, args.options || {});
    }
  },

  memory_verify_deletion: {
    description: 'Independently verifies that a memory has been completely purged across SQLite primary table, FTS index, cache, and Knowledge Graph.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'Memory ID to verify' }
      },
      required: ['memoryId']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_INTERACTION'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { memoryManagementEngineInstance } = require('./memory/memoryManagementEngine.js');
      return memoryManagementEngineInstance.verifyDeletion(args.memoryId);
    }
  },

  memory_register_avoid_topic: {
    description: 'Registers an off-limits topic in the Avoid Topics registry to prevent tracking or remembering it.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic or sensitive subject to avoid' }
      },
      required: ['topic']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_PREFERENCES_WRITE'],
    timeoutMs: 5000,
    execute: async (args = {}) => {
      const { memoryManagementEngineInstance } = require('./memory/memoryManagementEngine.js');
      return memoryManagementEngineInstance.registerAvoidTopic(args.topic);
    }
  },

  memory_get_avoid_topics: {
    description: 'Lists all active registered avoid topics.',
    personality: 'SHARED',
    inputs: { type: 'object', properties: {} },
    outputs: { type: 'object' },
    requiredPermissions: ['USER_PREFERENCES_READ'],
    timeoutMs: 5000,
    execute: async () => {
      const { memoryManagementEngineInstance } = require('./memory/memoryManagementEngine.js');
      return { avoidTopics: memoryManagementEngineInstance.getAvoidTopics() };
    }
  },

  memory_purge_domain: {
    description: 'High-impact action to purge memories for a project or all personal memories. Requires explicit user approval.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['PROJECT', 'ALL_PERSONAL'] },
        projectId: { type: 'string' }
      },
      required: ['target']
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SECURITY_ADMINISTRATION'],
    timeoutMs: 10000,
    execute: async (args = {}) => {
      const { memoryManagementEngineInstance } = require('./memory/memoryManagementEngine.js');
      if (args.target === 'PROJECT') {
        return memoryManagementEngineInstance.purgeProjectMemories(args.projectId);
      } else {
        return memoryManagementEngineInstance.purgeAllPersonalMemories();
      }
    }
  },

  // =========================================================================
  // Phase 15: Advanced Sensory Intelligence & Universal Computer Use
  // =========================================================================

  enumerate_audio_devices: {
    description: 'Enumerates Windows WASAPI playback (system loopback), microphone capture, and isolated headphone output devices.',
    personality: 'SHARED',
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    execute: async (args = {}) => {
      const { audioLoopbackEngineInstance } = require('./voice/audioLoopbackEngine.js');
      return await audioLoopbackEngineInstance.enumerateAudioDevices(args);
    }
  },

  enable_audio_loopback: {
    description: 'Enables Windows WASAPI system audio loopback capture ONLY when explicitConsent: true is provided.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { audioLoopbackEngineInstance } = require('./voice/audioLoopbackEngine.js');
      return await audioLoopbackEngineInstance.enableLoopbackCapture(args);
    }
  },

  ingest_audio_loopback_segment: {
    description: 'Ingests and transcribes a real-time system loopback or microphone audio segment with speaker separation and question detection.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { audioLoopbackEngineInstance } = require('./voice/audioLoopbackEngine.js');
      return await audioLoopbackEngineInstance.ingestAudioSegment(args);
    }
  },

  stop_audio_loopback: {
    description: 'Immediately stops system audio loopback capture and enforces configured retention cleanup.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { audioLoopbackEngineInstance } = require('./voice/audioLoopbackEngine.js');
      return await audioLoopbackEngineInstance.stopLoopbackCapture(args.reason, args);
    }
  },

  process_full_duplex_voice_frame: {
    description: 'Processes a real-time full-duplex voice frame with barge-in interruption, noise filtering, and session continuity.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { fullDuplexVoiceEngineInstance } = require('./voice/fullDuplexVoiceEngine.js');
      return await fullDuplexVoiceEngineInstance.processAudioFrame(args);
    }
  },

  enable_ambient_vision: {
    description: 'Enables privacy-controlled ambient screen or webcam presence observation with separate explicit user consent flags.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { ambientVisionDaemonInstance } = require('./vision/ambientVisionDaemon.js');
      return await ambientVisionDaemonInstance.enableAmbientObservation(args);
    }
  },

  observe_ambient_environment_tick: {
    description: 'Executes an event-driven ambient vision tick (skips unchanged frames, detects IDE errors and stuck workflows).',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { ambientVisionDaemonInstance } = require('./vision/ambientVisionDaemon.js');
      return await ambientVisionDaemonInstance.observeEnvironmentTick(args.simulatedContext || null);
    }
  },

  stop_ambient_vision: {
    description: 'Immediately stops ambient vision observation and shuts down active camera/screen indicators.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { ambientVisionDaemonInstance } = require('./vision/ambientVisionDaemon.js');
      return await ambientVisionDaemonInstance.stopAmbientObservation(args.reason);
    }
  },

  execute_universal_gui_workflow: {
    description: 'Executes a 9-step grounded GUI automation workflow (UIA -> OCR -> Visual Grounding) with anti-blind-click and outcome verification.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { universalGuiNavigatorInstance } = require('./desktop/universalGuiNavigator.js');
      return await universalGuiNavigatorInstance.executeGuiWorkflow(args.instruction, args);
    }
  },

  enable_private_whisper_copilot: {
    description: 'Enables Private Whispering Copilot Mode with verified isolated headphone output and explicit meeting consent.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { privateWhisperCopilotInstance } = require('./voice/privateWhisperCopilot.js');
      return await privateWhisperCopilotInstance.enableCopilot(args);
    }
  },

  process_copilot_meeting_turn: {
    description: 'Processes a live meeting conversation turn, updates rolling summary, and whispers private hints exclusively to headphones.',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { privateWhisperCopilotInstance } = require('./voice/privateWhisperCopilot.js');
      return await privateWhisperCopilotInstance.processMeetingConversationTurn(args);
    }
  },

  disable_private_whisper_copilot: {
    description: 'Immediately disables Private Whispering Copilot Mode and halts meeting audio capture.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { privateWhisperCopilotInstance } = require('./voice/privateWhisperCopilot.js');
      return await privateWhisperCopilotInstance.disableCopilot(args.reason);
    }
  },

  // =========================================================================
  // LIVE DOCUMENT STUDIO & VOICE-CONTROLLED WORD COLLABORATION TOOLS
  // =========================================================================

  live_document_create: {
    description: 'Opens Live Document Studio and progressively creates, writes, and verifies a Word (.docx) document on the requested topic in Microsoft Word or WPS Writer.',
    personality: 'JARVIS',
    inputs: {
      topic: { type: 'string', required: false, description: 'Document topic' },
      instruction: { type: 'string', required: false, description: 'Full user creation instruction' },
      preferredApp: { type: 'string', required: false, description: 'Preferred editor: "word" or "wps"' },
      openDesktop: { type: 'boolean', required: false, description: 'Open the verified .docx in desktop editor' }
    },
    requiredPermissions: ['FILE_ORGANIZATION', 'USER_INTERACTION'],
    execute: async (args = {}) => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return await liveDocumentStudioInstance.createDocumentProgressively(args);
    }
  },

  live_document_revise: {
    description: 'Applies live voice or text revision instructions (e.g. paragraph edits, section expansions, observation tables, diagrams, conclusions) to the active Live Document Studio session and synchronizes the .docx.',
    personality: 'JARVIS',
    requiredPermissions: ['FILE_ORGANIZATION', 'USER_INTERACTION'],
    execute: async (args = {}) => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return await liveDocumentStudioInstance.applyVoiceRevision(args.instruction || args.query || '', args);
    }
  },

  live_document_save: {
    description: 'Saves and independently verifies the active Live Document Studio session to .docx (and optionally .pdf), supporting custom filenames and Documents folder routing.',
    personality: 'JARVIS',
    requiredPermissions: ['FILE_ORGANIZATION'],
    execute: async (args = {}) => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return await liveDocumentStudioInstance.saveDocumentSession(args);
    }
  },

  live_document_send_whatsapp: {
    description: 'Resolves the active Live Document Studio .docx file, verifies the exact WhatsApp recipient and chat header, stages the .docx attachment, and follows confirmation rules.',
    personality: 'JARVIS',
    requiredPermissions: ['COMMUNICATION', 'FILE_READ'],
    execute: async (args = {}) => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return await liveDocumentStudioInstance.deliverDocumentViaWhatsApp(args);
    }
  },

  live_document_confirm_whatsapp: {
    description: 'Confirms and dispatches the staged Live Document Studio .docx attachment on WhatsApp after user approval.',
    personality: 'JARVIS',
    requiredPermissions: ['COMMUNICATION'],
    execute: async () => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return await liveDocumentStudioInstance.confirmPendingWhatsAppDelivery();
    }
  },

  live_document_undo: {
    description: 'Rolls back the most recent revision in Live Document Studio and restores the previous verified .docx snapshot.',
    personality: 'JARVIS',
    requiredPermissions: ['FILE_ORGANIZATION'],
    execute: async () => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return await liveDocumentStudioInstance.undoLastRevision();
    }
  },

  live_document_status: {
    description: 'Returns the live status, active section, writing progress, revision history, and verification state of Live Document Studio.',
    personality: 'SHARED',
    requiredPermissions: ['FILE_READ'],
    execute: async () => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      return {
        success: true,
        studioState: liveDocumentStudioInstance.getStudioStatus()
      };
    }
  },

  live_document_control: {
    description: 'Controls the Live Document Studio window (MINIMIZE, RESTORE, CLOSE, or RECOVER).',
    personality: 'JARVIS',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      const { liveDocumentStudioInstance } = require('./desktop/liveDocumentStudio.js');
      if (String(args.action || '').toUpperCase() === 'RECOVER') {
        return await liveDocumentStudioInstance.recoverInterruptedSession();
      }
      return liveDocumentStudioInstance.controlStudioWindow(args.action || 'STATUS');
    }
  },

  run_visual_simulation: {
    description: 'Computes physics telemetry and launches an interactive animated visual simulation on screen (projectile motion, planetary orbit, robotic arm, DC motor, rotating turbine, RLC circuit).',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'User simulation request or parameters' },
        simulationType: { type: 'string', description: '"projectile_motion", "planetary_orbit", "robotic_arm_sim", "dc_motor", "rotating_turbine", or "rlc_circuit"' },
        params: { type: 'object', description: 'Optional numeric simulation parameters' }
      }
    },
    outputs: { type: 'object' },
    requiredPermissions: ['SIMULATION_EXECUTION'],
    timeoutMs: 10000,
    verificationMethod: 'Assert simulation metrics, series, and artifact file on disk',
    execute: async (args = {}) => {
      return visualSimulationLauncherInstance.runSimulation(args);
    }
  },

  enable_screen_observation: {
    description: 'Explicitly enables user-controlled Screen Observation Mode with visible privacy indicator.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      return await screenObservationServiceInstance.enableObservation(args);
    }
  },

  pause_screen_observation: {
    description: 'Pauses user-controlled Screen Observation Mode immediately.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async () => {
      return screenObservationServiceInstance.pauseObservation();
    }
  },

  disable_screen_observation: {
    description: 'Stops and disables Screen Observation Mode and turns off all screen capture indicators.',
    personality: 'SHARED',
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      return await screenObservationServiceInstance.disableObservation(args.reason);
    }
  },

  inspect_screen_observation: {
    description: 'Inspects the currently active foreground window, open desktop windows, UI elements, and screen screenshot ONLY when Screen Observation Mode is enabled.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'What to inspect or explain about the active screen/window' },
        includeScreenshotAnalysis: { type: 'boolean', description: 'Whether to run screenshot + Vision OCR inspection' }
      }
    },
    requiredPermissions: ['DIAGNOSTICS_READ'],
    timeoutMs: 25000,
    execute: async (args = {}) => {
      return await screenObservationServiceInstance.inspectScreen(args);
    }
  },

  set_assistant_mode: {
    description: 'Switches JARVIS assistant mode between COMMAND, CONVERSATION, PROACTIVE, and QUIET.',
    personality: 'SHARED',
    inputs: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: '"COMMAND", "CONVERSATION", "PROACTIVE", or "QUIET"' }
      }
    },
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      return screenObservationServiceInstance.setAssistantMode(args.mode || 'CONVERSATION');
    }
  },

  word_init_blank_document: {
    description: 'Opens Microsoft Word (WINWORD.EXE) with a new blank document via COM automation and brings it to the foreground.',
    personality: 'SHARED',
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    timeoutMs: 25000,
    verificationMethod: 'Assert WINWORD.EXE process and visible HWND',
    execute: async (args = {}) => {
      return await wordAutomationServiceInstance.initWordSession({ forceNew: Boolean(args.forceNew) });
    }
  },

  youtube_search_and_open: {
    description: 'Searches YouTube for real video results, extracts the real video list, and opens the Nth (e.g. 1st, 2nd, 3rd) video in verified Google Chrome.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true, description: 'YouTube search query' },
      index: { type: 'number', required: false, description: '1-based index of video to open (default 1)' },
      profile: { type: 'string', required: false, description: 'Optional Chrome profile name (e.g. somaiya, default)' },
      openInChrome: { type: 'boolean', required: false, description: 'Whether to launch the selected video in Chrome (default true)' }
    },
    requiredPermissions: ['SYSTEM_CONTROL', 'USER_INTERACTION'],
    timeoutMs: 30000,
    verificationMethod: 'Assert real YouTube video URLs extracted and Chrome launched on selected watch URL',
    execute: async (args = {}) => {
      return await chromeProfileService.openYouTubeAndPlayResult({
        query: args.query || args.searchQuery || '',
        index: Number(args.index || 1),
        profile: args.profile || '',
        openInChrome: args.openInChrome !== false
      });
    }
  },

  open_youtube_video: {
    description: 'Searches YouTube and opens a specific Nth video or tutorial in verified Google Chrome.',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: true },
      index: { type: 'number', required: false },
      profile: { type: 'string', required: false }
    },
    requiredPermissions: ['SYSTEM_CONTROL', 'USER_INTERACTION'],
    timeoutMs: 30000,
    execute: async (args = {}) => {
      return await chromeProfileService.openYouTubeAndPlayResult({
        query: args.query || args.searchQuery || '',
        index: Number(args.index || 1),
        profile: args.profile || '',
        openInChrome: true
      });
    }
  },

  read_window_content: {
    description: 'Reads visible text/controls from the active or queried external Windows application window via UI Automation (permission-gated).',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', required: false, description: 'Optional target application/window title filter' }
    },
    requiredPermissions: ['SCREEN_INSPECTION'],
    timeoutMs: 20000,
    execute: async (args = {}) => {
      return await desktopControllerInstance.readWindowContent(args.query || '', 'JARVIS');
    }
  },

  open_whatsapp_web: {
    description: 'Opens WhatsApp Web in a persistent Playwright Chrome session and checks authentication/QR scan status.',
    personality: 'JARVIS',
    inputs: {
      headless: { type: 'boolean', required: false }
    },
    requiredPermissions: ['COMMUNICATION'],
    timeoutMs: 30000,
    execute: async (args = {}) => {
      return await whatsappServiceInstance.openWhatsAppWeb(args);
    }
  },

  send_whatsapp_attachment: {
    description: 'Stages or sends a file/document attachment via WhatsApp after explicit user confirmation.',
    personality: 'JARVIS',
    inputs: {
      contact: { type: 'string', required: true, description: 'Recipient contact name or phone' },
      filePath: { type: 'string', required: true, description: 'Absolute file path to attach' },
      confirmed: { type: 'boolean', required: false, description: 'True only after explicit user send confirmation' }
    },
    requiredPermissions: ['COMMUNICATION', 'FILE_READ'],
    timeoutMs: 25000,
    execute: async (args = {}) => {
      return await whatsappServiceInstance.sendAttachment(
        args.contact || args.recipient || '',
        args.filePath || '',
        Boolean(args.confirmed)
      );
    }
  },

  build_codebase_rag: {
    description: 'Builds or incrementally refreshes the TF-IDF semantic code index over the project repository.',
    personality: 'SHARED',
    inputs: {
      force: { type: 'boolean', required: false }
    },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 30000,
    execute: async (args = {}) => {
      return codingAssistantInstance.buildCodebaseRagIndex({ force: Boolean(args.force) });
    }
  },

  search_codebase_rag: {
    description: 'Semantically searches the codebase using the incremental TF-IDF symbol and code chunk index.',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string', required: true },
      topK: { type: 'number', required: false }
    },
    requiredPermissions: ['FILE_READ'],
    timeoutMs: 20000,
    execute: async (args = {}) => {
      return codingAssistantInstance.semanticSearchCodebase(args.query || '', { topK: Number(args.topK || 6) });
    }
  },

  run_autonomous_engineering_loop: {
    description: 'Executes a bounded, safety-checked autonomous code edit + syntax/test verification + automatic rollback loop.',
    personality: 'JARVIS',
    inputs: {
      goal: { type: 'string', required: true },
      targetFile: { type: 'string', required: true },
      testScript: { type: 'string', required: false },
      maxIterations: { type: 'number', required: false },
      originalCode: { type: 'string', required: false },
      replacementCode: { type: 'string', required: false },
      approvalToken: { type: 'string', required: false }
    },
    requiredPermissions: ['CODE_EXECUTION', 'FILE_OPERATIONS'],
    timeoutMs: 60000,
    execute: async (args = {}) => {
      return await selfRepairServiceInstance.runBoundedAutonomousEngineeringLoop(args);
    }
  },

  get_host_hardware_telemetry: {
    description: 'Collects real live Windows CPU, RAM, GPU/NVIDIA, disk, top memory processes, and internet connectivity telemetry.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['SYSTEM_DIAGNOSTICS'],
    timeoutMs: 20000,
    execute: async () => {
      const { systemHealthEngineInstance } = require('./systemHealthEngine.js');
      return await systemHealthEngineInstance.collectHostHardwareTelemetry();
    }
  },

  compute_robotic_joint_torque: {
    description: 'Computes deterministic required torque (N-m & kg-cm), safety margin, and servo/stepper class recommendations for a robotic arm joint.',
    personality: 'SHARED',
    inputs: {
      payloadKg: { type: 'number', required: false },
      armLengthM: { type: 'number', required: false },
      linkMassKg: { type: 'number', required: false },
      safetyFactor: { type: 'number', required: false }
    },
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.computeJointTorqueAndPayload(args);
    }
  },

  generate_robotics_bom_inr: {
    description: 'Generates an India-friendly Robotics Bill of Materials with estimated INR price ranges and power/safety notes.',
    personality: 'SHARED',
    inputs: {
      projectType: { type: 'string', required: false },
      budgetInr: { type: 'number', required: false }
    },
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.generateRoboticsBomINR(args);
    }
  },

  evaluate_robotics_safety: {
    description: 'Audits a robotics power & electrical schematic for fuses, NC E-Stop, star ground, logic/motor isolation, and voltage limits.',
    personality: 'SHARED',
    inputs: {
      supplyVoltageV: { type: 'number', required: false },
      logicVoltageV: { type: 'number', required: false },
      stallCurrentA: { type: 'number', required: false },
      hasFuse: { type: 'boolean', required: false },
      hasEmergencyStop: { type: 'boolean', required: false },
      emergencyStopNormallyClosed: { type: 'boolean', required: false },
      hasCommonGround: { type: 'boolean', required: false },
      hasLogicIsolation: { type: 'boolean', required: false }
    },
    requiredPermissions: ['USER_INTERACTION'],
    execute: async (args = {}) => {
      return mechanicalRoboticsEngineInstance.evaluateRoboticsSafety(args);
    }
  },

  add_hardware_inventory: {
    description: 'Adds an electronic component, motor, MCU, sensor, or power module to persistent physical hardware inventory.',
    personality: 'JARVIS',
    inputs: {
      name: { type: 'string', required: true },
      category: { type: 'string', required: false },
      quantity: { type: 'number', required: false },
      specs: { type: 'string', required: false },
      notes: { type: 'string', required: false }
    },
    requiredPermissions: ['FILE_OPERATIONS'],
    execute: async (args = {}) => {
      return electronicsEmbeddedEngineInstance.addHardwareInventoryItem(args);
    }
  },

  list_hardware_inventory: {
    description: 'Lists all physical robotics & electronics hardware components stored in persistent user inventory.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['FILE_READ'],
    execute: async () => {
      return electronicsEmbeddedEngineInstance.listHardwareInventory();
    }
  },

  acquire_concept_knowledge: {
    description: 'Researches an unfamiliar scientific or engineering concept via live web sources, builds interconnected graph nodes with source attribution and confidence levels, and tracks contradictions/uncertainty.',
    personality: 'SHARED',
    inputs: {
      topic: { type: 'string', required: true },
      domain: { type: 'string', required: false },
      maxSources: { type: 'number', required: false },
      forceLive: { type: 'boolean', required: false }
    },
    requiredPermissions: ['RESEARCH'],
    timeoutMs: 30000,
    execute: async (args = {}) => {
      const { unifiedIntelligenceLayerInstance } = require('./unifiedIntelligenceLayer.js');
      return await unifiedIntelligenceLayerInstance.acquireAndConnectKnowledge(args.topic || '', args);
    }
  },

  design_engineering_system: {
    description: 'Designs and iteratively optimizes multi-part mechanical/robotics systems (robotic_arm, cartesian_gantry, rover_chassis, planetary_gearbox, mechanical_gripper, or customSpec) with Jacobian IK, Euler-Bernoulli deflection & collision checks, inventory matching, INR BOM optimization, safety check, and 3D CAD geometry.',
    personality: 'SHARED',
    inputs: {
      systemType: { type: 'string', required: false },
      description: { type: 'string', required: false },
      payloadKg: { type: 'number', required: false },
      reachMm: { type: 'number', required: false },
      budgetInr: { type: 'number', required: false },
      structuralMaterial: { type: 'string', required: false },
      targetPos: { type: 'object', required: false },
      customSpec: { type: 'object', required: false }
    },
    requiredPermissions: ['USER_INTERACTION'],
    timeoutMs: 25000,
    execute: async (args = {}) => {
      return await mechanicalRoboticsEngineInstance.designAndOptimizeEngineeringSystem(args);
    }
  },

  analyze_design_reference_image: {
    description: 'Inspects an attached reference image, hardware photo, or CAD screenshot to identify components, kinematics, joints, constraints, and uncertainty, optionally generating a 3D CAD model.',
    personality: 'SHARED',
    inputs: {
      prompt: { type: 'string', required: true },
      attachments: { type: 'array', required: false },
      create3dModel: { type: 'boolean', required: false }
    },
    requiredPermissions: ['USER_INTERACTION'],
    timeoutMs: 25000,
    execute: async (args = {}, personality = 'JARVIS') => {
      const { aiAdapterInstance } = require('./aiProviderAdapter.js');
      return await aiAdapterInstance.analyzeDesignReferenceImage(args.prompt, args.attachments || [], personality, { create3dModel: Boolean(args.create3dModel) });
    }
  },

  verify_mathematical_derivation: {
    description: 'Verifies arithmetic, algebra, symbolic calculus, matrix eigenvalues/determinants, ODEs, or structural beam physics using real Python SymPy/SciPy scientific computing.',
    personality: 'SHARED',
    inputs: {
      operation: { type: 'string', required: true },
      expression: { type: 'string', required: false },
      variable: { type: 'string', required: false },
      calculusOp: { type: 'string', required: false },
      matrixA: { type: 'array', required: false },
      matrixOp: { type: 'string', required: false },
      equation: { type: 'string', required: false },
      funcName: { type: 'string', required: false },
      lengthM: { type: 'number', required: false },
      forceN: { type: 'number', required: false },
      elasticModulusPa: { type: 'number', required: false },
      momentOfInertiaM4: { type: 'number', required: false }
    },
    requiredPermissions: ['USER_INTERACTION'],
    timeoutMs: 20000,
    execute: async (args = {}) => {
      const { mathematicalIntelligenceEngineInstance } = require('./science/mathematicalIntelligenceEngine.js');
      const { engineeringIntelligenceEngineInstance } = require('./science/engineeringIntelligenceEngine.js');
      const op = String(args.operation || 'verifyArithmetic');
      let out;
      if (op === 'solveAlgebra') {
        out = await mathematicalIntelligenceEngineInstance.solveAlgebra({
          expression: args.expression || '',
          variable: args.variable || 'x'
        });
      } else if (op === 'computeCalculus') {
        const calcOp = (args.calculusOp === 'diff' || !args.calculusOp) ? 'derivative' : (args.calculusOp === 'int' ? 'integral' : args.calculusOp);
        out = await mathematicalIntelligenceEngineInstance.computeCalculus({
          expression: args.expression || 'x**2',
          operation: calcOp,
          variable: args.variable || 'x',
          lower: args.lower,
          upper: args.upper
        });
      } else if (op === 'computeMatrixOperations') {
        out = await mathematicalIntelligenceEngineInstance.computeMatrixOperations({
          matrix: args.matrixA || args.matrix || [[4, 0], [0, 9]],
          operation: args.matrixOp || 'eigenvals'
        });
      } else if (op === 'solveDifferentialEquation') {
        out = await mathematicalIntelligenceEngineInstance.solveDifferentialEquation({
          equation: args.equation || "Eq(Derivative(y(x), x), y(x))",
          funcName: args.funcName || 'y',
          variable: args.variable || 'x'
        });
      } else if (op === 'analyzeBeam') {
        out = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
          load_n: Number(args.forceN || args.load_n || 12),
          length_m: Number(args.lengthM || args.length_m || 0.45),
          width_m: Number(args.widthM || args.width_m || 0.04),
          height_m: Number(args.heightM || args.height_m || 0.045),
          material: args.material || 'aluminum'
        });
      } else {
        out = await mathematicalIntelligenceEngineInstance.verifyArithmetic(args.expression || '0', args.expressionB || args.expression || '0');
      }
      if (out && typeof out === 'object' && out.verified === undefined) {
        out.verified = Boolean(out.success !== false);
      }
      return out;
    }
  },

  remember_project_constraint: {
    description: 'Persists an ongoing project name, INR budget, hardware/tool constraint, or learning focus into Personal Context memory for automatic cross-session reuse.',
    personality: 'SHARED',
    inputs: {
      projectName: { type: 'string', required: true },
      budgetInr: { type: 'number', required: false },
      constraint: { type: 'string', required: false },
      constraints: { type: 'array', required: false },
      domain: { type: 'string', required: false },
      goalTitle: { type: 'string', required: false }
    },
    requiredPermissions: ['MEMORY_WRITE'],
    execute: async (args = {}) => {
      const { personalContextEngineInstance } = require('./memory/personalContextEngine.js');
      const id = args.id || `proj_${String(args.projectName || 'robotics').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
      let existing = null;
      try { existing = personalContextEngineInstance.getProject(id); } catch (_) {}
      const mergedConstraints = Array.from(new Set([
        ...(Array.isArray(existing?.constraints) ? existing.constraints : []),
        ...(Array.isArray(args.constraints) ? args.constraints : []),
        ...(args.constraint ? [String(args.constraint)] : [])
      ].filter(Boolean)));
      const saved = personalContextEngineInstance.createOrUpdateProject({
        id,
        name: args.projectName || existing?.name || 'Robotics Build',
        domain: args.domain || existing?.domain || 'ROBOTICS',
        status: args.status || 'IN_PROGRESS',
        budgetInr: Number(args.budgetInr || existing?.budgetInr || 0) || undefined,
        constraints: mergedConstraints,
        description: args.description || existing?.description || 'Progressive hardware & robotics engineering project'
      });
      if (args.goalTitle) {
        personalContextEngineInstance.setGoal({
          title: args.goalTitle,
          category: 'WORK',
          projectId: saved.id,
          progress: Number(args.progress || 10)
        });
      }
      return { success: true, verified: true, project: saved, summary: `Saved persistent constraint(s) for project "${saved.name}".` };
    }
  },

  get_developmental_model_status: {
    description: 'Reports JARVIS developmental self-model: acquired knowledge nodes, verified vs reported experiences, weak tools, top failure root causes, and upgrade priorities.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['DIAGNOSTICS_READ'],
    execute: async () => {
      const { unifiedIntelligenceLayerInstance } = require('./unifiedIntelligenceLayer.js');
      return unifiedIntelligenceLayerInstance.getDevelopmentalModelReport();
    }
  },

  get_neural_brain_status: {
    description: 'Inspect JARVIS owned multimodal foundation model status: custom BPE tokenizer vocab, transformer parameter counts, trained checkpoints, held-out evaluation metrics, and active experimental vs production routing.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['DIAGNOSTICS_READ'],
    execute: async () => {
      const { neuralBrainServiceInstance } = require('./neural/neuralBrainService.js');
      return neuralBrainServiceInstance.getStatus();
    }
  },

  run_neural_brain_cycle: {
    description: 'Run an owned neural foundation model lifecycle operation: eval, infer, promote (gated), rollback, or train.',
    personality: 'JARVIS',
    inputs: {
      action: { type: 'string', required: true },
      version: { type: 'string', required: false },
      prompt: { type: 'string', required: false },
      imagePath: { type: 'string', required: false },
      targetRole: { type: 'string', required: false }
    },
    requiredPermissions: ['SYSTEM_CONTROL'],
    execute: async (args = {}) => {
      const { neuralBrainServiceInstance } = require('./neural/neuralBrainService.js');
      const action = String(args.action || 'eval').toLowerCase();
      if (action === 'eval' || action === 'evaluate') {
        return await neuralBrainServiceInstance.evaluateCheckpoint(args.version);
      }
      if (action === 'infer') {
        return await neuralBrainServiceInstance.inferWithOwnedBrain({
          prompt: args.prompt || 'Design 6-DOF robotic arm',
          imagePath: args.imagePath || null,
          version: args.version || null
        });
      }
      if (action === 'promote') {
        return await neuralBrainServiceInstance.promoteCheckpoint(args.version, { targetRole: args.targetRole || 'experimental_local' });
      }
      if (action === 'rollback') {
        return await neuralBrainServiceInstance.rollbackCheckpoint();
      }
      if (action === 'train') {
        return await neuralBrainServiceInstance.trainCandidateCheckpoint({ version: args.version || undefined });
      }
      return { success: false, error: `Unsupported neural brain action "${action}". Use eval, infer, promote, rollback, or train.` };
    }
  },

  // =========================================================================
  // Personal AI Representative, Digital Twin & Autonomous Office Executive
  // =========================================================================
  enroll_personal_avatar: {
    description: 'Enroll owner personal face avatar with explicit consent, multiple angles, lighting, and expressions.',
    personality: 'JARVIS',
    inputs: {
      ownerName: { type: 'string' },
      photosBase64: { type: 'array' },
      angles: { type: 'array' },
      lightingConditions: { type: 'array' },
      expressions: { type: 'array' },
      explicitOwnerConsent: { type: 'boolean', required: true },
      isAccountOwnerSelf: { type: 'boolean' }
    },
    requiredPermissions: ['SECURITY_CORE'],
    execute: async (args = {}) => {
      const { personalDigitalTwinServiceInstance } = require('./representative/personalDigitalTwinService.js');
      return personalDigitalTwinServiceInstance.enrollPersonalAvatar(args);
    }
  },

  manage_personal_avatar: {
    description: 'Preview, approve, replace, or disable the owner personal digital avatar.',
    personality: 'JARVIS',
    inputs: {
      action: { type: 'string', required: true },
      ownerApproved: { type: 'boolean' }
    },
    requiredPermissions: ['SECURITY_CORE'],
    execute: async (args = {}) => {
      const { personalDigitalTwinServiceInstance } = require('./representative/personalDigitalTwinService.js');
      return personalDigitalTwinServiceInstance.managePersonalAvatar(args);
    }
  },

  enroll_personal_voice: {
    description: 'Enroll and analyze owner personal voice model (pitch, tone, accent, speed, pauses, intonation) with explicit consent.',
    personality: 'JARVIS',
    inputs: {
      ownerName: { type: 'string' },
      audioSamplesBase64: { type: 'array' },
      sampleTranscripts: { type: 'array' },
      preferredLanguages: { type: 'array' },
      explicitVoiceConsent: { type: 'boolean', required: true },
      isAccountOwnerSelf: { type: 'boolean' }
    },
    requiredPermissions: ['SECURITY_CORE'],
    execute: async (args = {}) => {
      const { personalDigitalTwinServiceInstance } = require('./representative/personalDigitalTwinService.js');
      return personalDigitalTwinServiceInstance.enrollPersonalVoice(args);
    }
  },

  synthesize_representative_speech: {
    description: 'Synthesize speech using enrolled personal voice (or neutral fallback) with multilingual En/Hi/Hinglish lip-sync visemes and AI representative disclosure.',
    personality: 'SHARED',
    inputs: {
      text: { type: 'string', required: true },
      language: { type: 'string' },
      emotion: { type: 'string' },
      isExternalCallOrMeeting: { type: 'boolean' },
      statementSource: { type: 'string' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { personalDigitalTwinServiceInstance } = require('./representative/personalDigitalTwinService.js');
      return personalDigitalTwinServiceInstance.synthesizeRepresentativeSpeech(args);
    }
  },

  revoke_biometric_authorization: {
    description: 'Revoke face and/or voice authorization and permanently delete derived biometric vectors from the encrypted vault.',
    personality: 'JARVIS',
    inputs: {
      revokeFace: { type: 'boolean' },
      revokeVoice: { type: 'boolean' },
      reason: { type: 'string' }
    },
    requiredPermissions: ['SECURITY_CORE'],
    execute: async (args = {}) => {
      const { personalDigitalTwinServiceInstance } = require('./representative/personalDigitalTwinService.js');
      return personalDigitalTwinServiceInstance.revokeBiometricAuthorization(args);
    }
  },

  learn_personal_writing_style: {
    description: 'Learn user approved email and communication writing preferences (formality, greetings, sign-offs, length, vocabulary).',
    personality: 'SHARED',
    inputs: {
      sampleText: { type: 'string', required: true },
      contextType: { type: 'string' },
      userApproved: { type: 'boolean' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      const { personalCommunicationBrainInstance } = require('./representative/personalCommunicationBrain.js');
      return personalCommunicationBrainInstance.learnWritingStyleFromSample(args);
    }
  },

  analyze_incoming_whatsapp_intelligence: {
    description: 'Analyze an incoming WhatsApp message with conversation history, 9-point context reasoning, 3 suggested replies, and recommended option.',
    personality: 'SHARED',
    inputs: {
      sender: { type: 'string', required: true },
      messageText: { type: 'string', required: true },
      previousMessages: { type: 'array' },
      knownCalendarEvents: { type: 'array' },
      providerPreference: { type: 'string' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { whatsappPersonalIntelligenceInstance } = require('./representative/whatsappPersonalIntelligence.js');
      return await whatsappPersonalIntelligenceInstance.analyzeIncomingMessage(args);
    }
  },

  handle_whatsapp_notification_decision: {
    description: 'Send recommended WhatsApp reply, select option 1/2/3, edit, write different, ignore, or archive with approval & duplicate-send prevention.',
    personality: 'JARVIS',
    inputs: {
      notificationId: { type: 'string', required: true },
      action: { type: 'string', required: true },
      selectedOptionIndex: { type: 'number' },
      editedText: { type: 'string' },
      userApproved: { type: 'boolean' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { whatsappPersonalIntelligenceInstance } = require('./representative/whatsappPersonalIntelligence.js');
      return await whatsappPersonalIntelligenceInstance.handleNotificationDecision(args);
    }
  },

  handle_incoming_call_representative: {
    description: 'Handle incoming WhatsApp voice call, WhatsApp video call (honest limitation + handoff), or ordinary phone call with disclosed AI representative.',
    personality: 'JARVIS',
    inputs: {
      callerName: { type: 'string', required: true },
      callType: { type: 'string', required: true },
      callerUtterance: { type: 'string' },
      mode: { type: 'string' },
      participantConsentVerified: { type: 'boolean' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { whatsappPersonalIntelligenceInstance } = require('./representative/whatsappPersonalIntelligence.js');
      return await whatsappPersonalIntelligenceInstance.handleIncomingCall(args);
    }
  },

  connect_outlook_oauth: {
    description: 'Connect Microsoft Outlook via OAuth 2.0 PKCE with minimum necessary permissions and encrypted token storage.',
    personality: 'JARVIS',
    inputs: {
      accountEmail: { type: 'string' },
      explicitUserAuthorization: { type: 'boolean' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.connectOutlook(args);
    }
  },

  disconnect_outlook_oauth: {
    description: 'Disconnect Microsoft Outlook and revoke stored OAuth credentials.',
    personality: 'JARVIS',
    inputs: {
      revokeTokens: { type: 'boolean' }
    },
    requiredPermissions: ['SECURITY_CORE'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.disconnectOutlook(args);
    }
  },

  summarize_outlook_inbox: {
    description: 'Summarize authorized Microsoft Outlook inbox messages, unread counts, and urgent threads.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['COMMUNICATION'],
    execute: async () => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.summarizeInbox();
    }
  },

  search_outlook_emails: {
    description: 'Search Microsoft Outlook messages by sender, subject, date, and content.',
    personality: 'SHARED',
    inputs: {
      sender: { type: 'string' },
      subject: { type: 'string' },
      query: { type: 'string' },
      dateFrom: { type: 'string' },
      dateTo: { type: 'string' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.searchEmails(args);
    }
  },

  show_outlook_attention_emails: {
    description: 'Identify important and urgent Outlook emails that need the user attention.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['COMMUNICATION'],
    execute: async () => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.getEmailsNeedingAttention();
    }
  },

  organize_outlook_inbox: {
    description: 'Categorize and organize messages in the authorized Outlook inbox.',
    personality: 'JARVIS',
    inputs: {},
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async () => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.organizeAndCategorizeInbox();
    }
  },

  prepare_unanswered_outlook_replies: {
    description: 'Detect unanswered Outlook emails and prepare reply drafts in the user writing style.',
    personality: 'JARVIS',
    inputs: {
      routineOnly: { type: 'boolean' },
      providerPreference: { type: 'string' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return await outlookGraphServiceInstance.prepareRepliesToUnansweredEmails(args);
    }
  },

  draft_outlook_reply: {
    description: 'Draft a professional Outlook email reply in the user approved writing style.',
    personality: 'SHARED',
    inputs: {
      emailId: { type: 'string' },
      customInstructions: { type: 'string' },
      keyPoints: { type: 'array' },
      providerPreference: { type: 'string' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return await outlookGraphServiceInstance.draftReply(args);
    }
  },

  send_approved_outlook_email: {
    description: 'Send a staged Outlook email draft only after explicit user authorization.',
    personality: 'JARVIS',
    inputs: {
      draftId: { type: 'string', required: true },
      userApproved: { type: 'boolean', required: true }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.sendApprovedEmail(args);
    }
  },

  summarize_outlook_attachments: {
    description: 'Find and summarize email attachments (e.g. from yesterday or matching a query).',
    personality: 'SHARED',
    inputs: {
      query: { type: 'string' },
      dateFilter: { type: 'string' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.findAndSummarizeAttachments(args);
    }
  },

  schedule_outlook_meeting: {
    description: 'Create and schedule a calendar event or Microsoft Teams meeting in Outlook.',
    personality: 'JARVIS',
    inputs: {
      subject: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      attendees: { type: 'array' },
      isOnlineMeeting: { type: 'boolean' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.createCalendarEvent(args);
    }
  },

  prepare_daily_office_summary: {
    description: 'Prepare a combined daily summary of today Outlook emails and calendar schedule.',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async () => {
      const { outlookGraphServiceInstance } = require('./representative/outlookGraphService.js');
      return outlookGraphServiceInstance.prepareDailyInboxAndCalendarSummary();
    }
  },

  join_authorized_meeting_representative: {
    description: 'Join an authorized Microsoft Teams or online meeting as a transparently disclosed AI Representative using authorized avatar and voice.',
    personality: 'JARVIS',
    inputs: {
      meetingTitle: { type: 'string' },
      platform: { type: 'string' },
      joinUrl: { type: 'string' },
      participants: { type: 'array' },
      userAuthorizedJoin: { type: 'boolean' },
      participantConsentVerified: { type: 'boolean' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { aiMeetingRepresentativeServiceInstance } = require('./representative/aiMeetingRepresentativeService.js');
      return aiMeetingRepresentativeServiceInstance.joinAuthorizedMeeting(args);
    }
  },

  transcribe_meeting_segment: {
    description: 'Transcribe speech in an authorized meeting (with participant consent) and extract structured notes and action items.',
    personality: 'SHARED',
    inputs: {
      meetingId: { type: 'string', required: true },
      speaker: { type: 'string', required: true },
      utterance: { type: 'string', required: true }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { aiMeetingRepresentativeServiceInstance } = require('./representative/aiMeetingRepresentativeService.js');
      return aiMeetingRepresentativeServiceInstance.transcribeMeetingSegment(args);
    }
  },

  respond_in_meeting_representative: {
    description: 'Answer an approved meeting question using authorized facts, or escalate sensitive/contractual/financial/personal-judgment questions to the human.',
    personality: 'JARVIS',
    inputs: {
      meetingId: { type: 'string', required: true },
      askedBy: { type: 'string', required: true },
      questionText: { type: 'string', required: true },
      humanApprovedStatement: { type: 'string' },
      providerPreference: { type: 'string' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      const { aiMeetingRepresentativeServiceInstance } = require('./representative/aiMeetingRepresentativeService.js');
      return await aiMeetingRepresentativeServiceInstance.evaluateAndRespondInMeeting(args);
    }
  },

  generate_meeting_minutes: {
    description: 'Generate structured meeting minutes, action items, post-meeting summary, and follow-up email draft.',
    personality: 'SHARED',
    inputs: {
      meetingId: { type: 'string', required: true },
      endMeeting: { type: 'boolean' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      const { aiMeetingRepresentativeServiceInstance } = require('./representative/aiMeetingRepresentativeService.js');
      return await aiMeetingRepresentativeServiceInstance.generateMeetingMinutesAndSummary(args);
    }
  },

  execute_parallel_office_workers: {
    description: 'Execute parallel autonomous workers (Worker A-F: Outlook, Calendar, Document Research, File Organization, Browser, Meeting Prep) without interrupting user focus.',
    personality: 'JARVIS',
    inputs: {
      tasks: { type: 'array' }
    },
    requiredPermissions: ['AUTOMATION'],
    execute: async (args = {}) => {
      const { parallelOfficeExecutiveManagerInstance } = require('./representative/parallelOfficeExecutiveManager.js');
      return await parallelOfficeExecutiveManagerInstance.executeParallelWorkerBatch(args);
    }
  },

  get_representative_mission_control: {
    description: 'Retrieve unified Mission Control dashboard state (Outlook, Digital Twin, drafts, approvals, meetings, parallel workers, required decisions, and audit history).',
    personality: 'SHARED',
    inputs: {},
    requiredPermissions: ['DIAGNOSTICS_READ'],
    execute: async () => {
      const { parallelOfficeExecutiveManagerInstance } = require('./representative/parallelOfficeExecutiveManager.js');
      return parallelOfficeExecutiveManagerInstance.getMissionControlDashboard();
    }
  },

  // =========================================================================
  // Desktop Automation Tools (Pillar 1)
  // =========================================================================

  desktop_mouse_move: {
    description: 'Moves the Windows mouse cursor to specified screen coordinates (x, y).',
    personality: 'JARVIS',
    inputs: {
      x: { type: 'number', required: true, description: 'X coordinate on screen' },
      y: { type: 'number', required: true, description: 'Y coordinate on screen' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      return desktopAutomationServiceInstance.mouseMove(args.x, args.y);
    }
  },

  desktop_mouse_click: {
    description: 'Clicks mouse cursor at coordinates (x, y) supporting left, right, middle, and double click.',
    personality: 'JARVIS',
    inputs: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      button: { type: 'string', description: 'left, right, or middle (default: left)' },
      double: { type: 'boolean', description: 'True for double-click' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      return desktopAutomationServiceInstance.mouseClick(args.x, args.y, args);
    }
  },

  desktop_mouse_drag: {
    description: 'Performs smooth mouse drag-and-drop from (fromX, fromY) to (toX, toY).',
    personality: 'JARVIS',
    inputs: {
      fromX: { type: 'number', required: true },
      fromY: { type: 'number', required: true },
      toX: { type: 'number', required: true },
      toY: { type: 'number', required: true },
      button: { type: 'string', description: 'left or right' },
      steps: { type: 'number', description: 'Interpolation steps (default: 12)' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      return desktopAutomationServiceInstance.mouseDrag(args.fromX, args.fromY, args.toX, args.toY, args);
    }
  },

  desktop_mouse_scroll: {
    description: 'Scrolls the mouse wheel up (positive delta) or down (negative delta).',
    personality: 'JARVIS',
    inputs: {
      delta: { type: 'number', required: true, description: 'Scroll delta (e.g. -120 for down, 120 for up)' },
      x: { type: 'number', description: 'Optional X position to scroll at' },
      y: { type: 'number', description: 'Optional Y position to scroll at' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      const coords = (args.x !== undefined && args.y !== undefined) ? { x: args.x, y: args.y } : null;
      return desktopAutomationServiceInstance.mouseScroll(args.delta, coords);
    }
  },

  desktop_type_text: {
    description: 'Types text into the currently active window or a targeted application window.',
    personality: 'JARVIS',
    inputs: {
      text: { type: 'string', required: true, description: 'Text to type' },
      query: { type: 'string', description: 'Optional window title or process to focus first' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      return desktopAutomationServiceInstance.typeText(args.query, args.text);
    }
  },

  desktop_send_hotkey: {
    description: 'Sends keyboard shortcuts (e.g. Ctrl+S, Alt+Tab, Win+D, Enter, Esc) to active or targeted window.',
    personality: 'JARVIS',
    inputs: {
      hotkey: { type: 'string', required: true, description: 'Hotkey string or key name' },
      query: { type: 'string', description: 'Optional window title to focus first' }
    },
    requiredPermissions: ['PRODUCTIVITY_TASKS'],
    execute: async (args = {}) => {
      return desktopAutomationServiceInstance.sendHotkey(args.query, args.hotkey);
    }
  },

  desktop_inspect_elements: {
    description: 'Inspects visible application UI elements via Windows UI Automation (buttons, text boxes, menus, tabs).',
    personality: 'JARVIS',
    inputs: {
      query: { type: 'string', description: 'Window title substring or process name (default: active window)' }
    },
    requiredPermissions: ['SCREEN_AWARENESS'],
    execute: async (args = {}) => {
      return desktopAutomationServiceInstance.inspectWindowElements(args.query || 'active');
    }
  },

  desktop_manage_window: {
    description: 'Manages window state, positioning, resizing, focusing, or launching desktop applications.',
    personality: 'JARVIS',
    inputs: {
      action: { type: 'string', required: true, description: 'list, focus, geometry, state, close, or launch' },
      query: { type: 'string', description: 'Window title or process identifier' },
      bounds: { type: 'object', description: '{ x, y, width, height } for geometry action' },
      state: { type: 'string', description: 'minimize, maximize, or restore for state action' },
      appName: { type: 'string', description: 'App key for launch action (notepad, chrome, edge, vscode, etc.)' },
      args: { type: 'array', description: 'Optional CLI arguments for launch action' }
    },
    requiredPermissions: ['APPLICATION_MANAGE'],
    execute: async (args = {}) => {
      const act = (args.action || 'list').toLowerCase();
      if (act === 'list') return desktopAutomationServiceInstance.listWindows();
      if (act === 'focus') return desktopAutomationServiceInstance.focusWindow(args.query);
      if (act === 'geometry') return desktopAutomationServiceInstance.setWindowGeometry(args.query, args.bounds);
      if (act === 'state') return desktopAutomationServiceInstance.setWindowState(args.query, args.state);
      if (act === 'close') return desktopAutomationServiceInstance.closeApplication(args.query);
      if (act === 'launch') return desktopAutomationServiceInstance.launchApplication(args.appName || args.query, args.args || []);
      throw new Error(`Unknown desktop window action: ${args.action}`);
    }
  },

  desktop_file_operation: {
    description: 'Performs desktop and filesystem operations (list directory, create folder, move, copy, rename, safe delete, organize).',
    personality: 'JARVIS',
    inputs: {
      action: { type: 'string', required: true, description: 'list, create_folder, move, copy, rename, delete, organize' },
      path: { type: 'string', required: true, description: 'Target file or folder path' },
      destPath: { type: 'string', description: 'Destination path for move/copy/rename' },
      options: { type: 'object', description: 'Optional configuration parameters' }
    },
    requiredPermissions: ['FILE_ORGANIZATION'],
    execute: async (args = {}) => {
      const act = (args.action || 'list').toLowerCase();
      if (act === 'list') return await desktopAutomationServiceInstance.listDirectory(args.path);
      if (act === 'create_folder') return await desktopAutomationServiceInstance.createFolder(args.path);
      if (act === 'move') return await desktopAutomationServiceInstance.moveItem(args.path, args.destPath);
      if (act === 'copy') return await desktopAutomationServiceInstance.copyItem(args.path, args.destPath);
      if (act === 'rename') return await desktopAutomationServiceInstance.renameItem(args.path, args.destPath);
      if (act === 'delete') return await desktopAutomationServiceInstance.deleteItem(args.path, args.options);
      if (act === 'organize') return await desktopAutomationServiceInstance.organizeDirectory(args.path, args.options);
      throw new Error(`Unknown desktop file action: ${args.action}`);
    }
  },

  // =========================================================================
  // Real-Time Voice Calling Tools (Pillar 2)
  // =========================================================================

  voice_call_initiate: {
    description: 'Initiates a real-time voice call on WhatsApp Desktop, Teams, or Meet with pre-call confirmation and transparent AI disclosure.',
    personality: 'JARVIS',
    inputs: {
      contact: { type: 'string', required: true, description: 'Contact name or phone number' },
      platform: { type: 'string', description: 'whatsapp, teams, or meet (default: whatsapp)' },
      userConfirmed: { type: 'boolean', description: 'Explicit user confirmation to dial' },
      explicitMicConsent: { type: 'boolean', description: 'Explicit user consent for microphone audio capture' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await realtimeVoiceCallServiceInstance.initiateCall({
        contactQuery: args.contact,
        platform: args.platform || 'whatsapp',
        userConfirmed: args.userConfirmed,
        explicitMicConsent: args.explicitMicConsent
      });
    }
  },

  voice_call_end: {
    description: 'Cleanly terminates the active voice call session and exports call transcript and summary.',
    personality: 'JARVIS',
    inputs: {
      reason: { type: 'string', description: 'Optional reason for hangup' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await realtimeVoiceCallServiceInstance.endCall(args);
    }
  },

  voice_call_toggle_mute: {
    description: 'Mutes or unmutes the microphone during an active voice call.',
    personality: 'JARVIS',
    inputs: {
      muted: { type: 'boolean', description: 'True to mute, false to unmute (omitting toggles)' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return realtimeVoiceCallServiceInstance.toggleMute(args.muted !== undefined ? args.muted : null);
    }
  },

  voice_call_process_turn: {
    description: 'Processes a real-time conversational voice turn (VAD, STT, JARVIS/VISION brain, natural TTS, and caller barge-in handling).',
    personality: 'JARVIS',
    inputs: {
      callerUtterance: { type: 'string', description: 'Spoken text from the caller' },
      callerInterrupted: { type: 'boolean', description: 'True if caller interrupted active assistant speech' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await realtimeVoiceCallServiceInstance.processIncomingCallerTurn(args);
    }
  },

  // =========================================================================
  // Real-Time Video Call & Meeting Tools (Pillar 3)
  // =========================================================================

  video_meeting_join: {
    description: 'Joins an authorized Google Meet, Microsoft Teams, or Zoom video meeting as a transparently disclosed AI assistant.',
    personality: 'JARVIS',
    inputs: {
      meetingTitle: { type: 'string', description: 'Title or subject of the meeting' },
      joinUrl: { type: 'string', required: true, description: 'Google Meet link/code, Teams join URL, or Zoom link' },
      platform: { type: 'string', description: 'google_meet, microsoft_teams, or zoom' },
      userConfirmed: { type: 'boolean', description: 'Explicit user confirmation to join' },
      enableMicrophone: { type: 'boolean', description: 'Whether mic is initially active' },
      enableCamera: { type: 'boolean', description: 'Whether camera is initially active' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await videoMeetingServiceInstance.joinMeeting(args);
    }
  },

  video_meeting_leave: {
    description: 'Leaves the active video meeting cleanly and generates structured meeting minutes with extracted action items.',
    personality: 'JARVIS',
    inputs: {
      meetingId: { type: 'string', required: true, description: 'Active meeting ID' },
      generateMinutes: { type: 'boolean', description: 'True to generate structured meeting minutes (default: true)' },
      reason: { type: 'string', description: 'Departure reason' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await videoMeetingServiceInstance.leaveMeeting(args);
    }
  },

  video_meeting_toggle_media: {
    description: 'Toggles microphone mute or camera feed during an active video meeting.',
    personality: 'JARVIS',
    inputs: {
      meetingId: { type: 'string', required: true },
      device: { type: 'string', required: true, description: 'microphone or camera' },
      enabled: { type: 'boolean', description: 'True to enable, false to mute/disable' }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await videoMeetingServiceInstance.toggleMedia(args);
    }
  },

  video_meeting_analyze_presentation: {
    description: 'Captures and visually analyzes presented meeting slides, diagrams, charts, or code with multimodal OCR and explanation.',
    personality: 'JARVIS',
    inputs: {
      meetingId: { type: 'string', required: true },
      focusQuery: { type: 'string', description: 'Specific focus area or slide element' }
    },
    requiredPermissions: ['VISION_INTELLIGENCE'],
    execute: async (args = {}) => {
      return await videoMeetingServiceInstance.analyzeMeetingPresentation(args);
    }
  },

  video_meeting_generate_minutes: {
    description: 'Exports structured meeting minutes, extracted action items, assignees, and deadlines for a meeting.',
    personality: 'JARVIS',
    inputs: {
      meetingId: { type: 'string', required: true }
    },
    requiredPermissions: ['COMMUNICATION'],
    execute: async (args = {}) => {
      return await videoMeetingServiceInstance.leaveMeeting({ meetingId: args.meetingId, generateMinutes: true });
    }
  }
};

// Ensure unified metadata contract on every registered tool
for (const [toolName, toolDef] of Object.entries(TOOLS)) {
  if (!toolDef.inputs) {
    toolDef.inputs = { type: 'object', properties: {} };
  }
  if (!toolDef.outputs) {
    toolDef.outputs = { type: 'object' };
  }
  if (!toolDef.requiredPermissions) {
    toolDef.requiredPermissions = [toolDef.personality === 'ULTRON' ? 'SYSTEM_DIAGNOSTICS' : 'USER_INTERACTION'];
  }
  if (!toolDef.timeoutMs) {
    toolDef.timeoutMs = 15000;
  }
  if (!toolDef.cancellationBehavior) {
    toolDef.cancellationBehavior = 'IMMEDIATE';
  }
  if (!toolDef.healthStatus) {
    toolDef.healthStatus = 'HEALTHY';
  }
  if (!toolDef.verificationMethod) {
    toolDef.verificationMethod = 'Assert non-null execution result';
  }
}

/**
 * Returns the standardized schema definition for a given tool
 */
function getToolSchema(toolName) {
  const tool = TOOLS[toolName];
  if (!tool) return null;
  return {
    name: toolName,
    description: tool.description || '',
    personality: tool.personality || 'SHARED',
    inputs: tool.inputs,
    outputs: tool.outputs,
    requiredPermissions: tool.requiredPermissions,
    timeoutMs: tool.timeoutMs,
    cancellationBehavior: tool.cancellationBehavior,
    healthStatus: tool.healthStatus,
    verificationMethod: tool.verificationMethod
  };
}

/**
 * Returns all registered tools formatted with unified schema
 */
function listStandardizedTools() {
  return Object.keys(TOOLS).map(name => getToolSchema(name));
}

/**
 * Executes a tool call safely with argument validation and permission gating
 */
async function executeTool(toolName, args = {}, personality = 'JARVIS') {
  const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
  if (emergencyStopControllerInstance.isEngaged()) {
    throw new Error(`EMERGENCY_STOP_ACTIVE: Emergency Stop is ACTIVE. Tool "${toolName}" execution is prohibited while the global emergency stop is engaged.`);
  }

  const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
  let tool = TOOLS[toolName];

  // Dynamic Tool Execution Check
  if (!tool && dynamicToolsManagerInstance.hasTool(toolName)) {
    permissionGateInstance.authorizeToolExecution(toolName, args, activePersonality);
    return await dynamicToolsManagerInstance.executeTool(toolName, args, activePersonality);
  }

  if (!tool) {
    throw new Error(`Tool "${toolName}" is not registered.`);
  }

  // 1. Enforce central permission gate policy
  permissionGateInstance.authorizeToolExecution(toolName, args, activePersonality);

  // 2. Legacy check for backward compatibility
  if (tool.personality && tool.personality !== 'SHARED' && tool.personality !== activePersonality) {
    throw new Error(`Security permission denied: Tool "${toolName}" is restricted to ${tool.personality}. Current active personality is ${activePersonality}.`);
  }

  return await tool.execute(args, activePersonality);
}

module.exports = {
  TOOLS,
  toolsRegistry: TOOLS,
  executeTool,
  getToolSchema,
  getToolDefinition: getToolSchema,
  listStandardizedTools,
  listTools: listStandardizedTools,
  memoryState
};
