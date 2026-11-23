/**
 * ULTRON × JARVIS — Central Operating Companion HTTP Server & API Gateway
 * Hosts the 60 FPS Living Code Eye interface and provides real-time Windows diagnostics,
 * static security analysis, allowlisted tool execution, and configurable AI model routing.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Auto-load .env configuration if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^['"](.*)['"]$/, '$1');
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
}

const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { conversationManagerInstance } = require('./server/conversationManager.js');
const { collectSystemDiagnostics } = require('./server/windowsDiagnostics.js');
const { analyzeCode } = require('./server/codeSecurityAnalyzer.js');
const { memoryManagerInstance } = require('./server/memoryManager.js');
const { taskManagerInstance } = require('./server/taskManager.js');
const { securityPermissionsInstance } = require('./server/securityPermissions.js');
const { desktopControllerInstance } = require('./server/desktop/desktopController.js');
const { windowsLocalAgentInstance } = require('./server/desktop/windowsLocalAgent.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { permissionManagerInstance } = require('./server/desktop/permissionManager.js');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { conversationalRelayServiceInstance } = require('./server/voice/conversationalRelayService.js');
const { fullDuplexVoiceEngineInstance } = require('./server/voice/fullDuplexVoiceEngine.js');
const { wakeWordDetectorInstance } = require('./server/voice/wakeWordDetector.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { languageVoiceManagerInstance } = require('./server/languageVoiceManager.js');
const { sttServiceInstance } = require('./server/sttService.js');
const { documentAnalyzerInstance } = require('./server/documentAnalyzer.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { timeServiceInstance } = require('./server/timeService.js');
const { taskOrchestratorInstance } = require('./server/taskOrchestrator.js');
const { visionServiceInstance } = require('./server/visionService.js');
const { latencyTrackerInstance } = require('./server/latencyTracker.js');
const { apiIntegrationsManagerInstance } = require('./server/apiIntegrationsManager.js');
const { elevationManagerInstance } = require('./server/desktop/elevationManager.js');
const { selfRepairServiceInstance } = require('./server/selfRepairService.js');
const { serviceHealingManagerInstance } = require('./server/serviceHealingManager.js');
const { selfDevelopmentEngineInstance } = require('./server/selfDevelopmentEngine.js');
const { dynamicToolsManagerInstance } = require('./server/dynamicToolsManager.js');
const { scientificComputationEngineInstance } = require('./server/scientificComputationEngine.js');
const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js');
const { electronicsEmbeddedEngineInstance } = require('./server/electronicsEmbeddedEngine.js');
const { aiDevelopmentLabInstance } = require('./server/aiDevelopmentLab.js');
const { neuralBrainServiceInstance } = require('./server/neural/neuralBrainService.js');
const { advancedResearchEngineInstance } = require('./server/advancedResearchEngine.js');
const { forecastingScenarioEngineInstance } = require('./server/forecastingScenarioEngine.js');
const { errorDiagnostics, ErrorCode } = require('./server/errorDiagnosticsService.js');
const { windowsAppRegistry } = require('./server/desktop/windowsAppRegistry.js');
const { chromeProfileService } = require('./server/desktop/chromeProfileService.js');
const { liveWebResearchService } = require('./server/research/liveWebResearchService.js');
const { spotifyController } = require('./server/desktop/spotifyController.js');
const { universal3dEngine } = require('./server/desktop/universal3dEngine.js');
const { autonomousDevelopmentLab } = require('./server/devlab/autonomousDevelopmentLab.js');
const { autonomousProjectOrchestratorInstance } = require('./server/autonomousProjectOrchestrator.js');
const knowledgeGraphEngine = require('./server/knowledgeGraphEngine.js');
const multiAgentOrchestrator = require('./server/multiAgentOrchestrator.js');
const proactiveAssistant = require('./server/proactiveAssistant.js');
const resourceComputeManager = require('./server/resourceComputeManager.js');
const brainArchitectureEngine = require('./server/brainArchitectureEngine.js');
const { capabilityRegistryInstance } = require('./server/capabilityRegistry.js');
const { experimentLedgerInstance } = require('./server/experimentLedger.js');
const { technicalExplainerInstance } = require('./server/technicalExplainer.js');
const { dependencyInvestigatorInstance } = require('./server/dependencyInvestigator.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { platformManagerInstance } = require('./server/platform/platformManager.js');
const { pluginManagerInstance } = require('./server/pluginManager.js');
const { distributedComputeEngineInstance } = require('./server/distributedComputeEngine.js');
const { modelLifecycleManagerInstance } = require('./server/modelLifecycleManager.js');
const { digitalTwinEngineInstance } = require('./server/digitalTwinEngine.js');
const { designExplorationEngineInstance } = require('./server/designExplorationEngine.js');
const { closedLoopExperimentationEngineInstance } = require('./server/closedLoopExperimentationEngine.js');
const { verificationAdversarialEngineInstance } = require('./server/verificationAdversarialEngine.js');
const { spatialComputingEngineInstance } = require('./server/spatialComputingEngine.js');
const { dataEngineeringPlatformInstance } = require('./server/dataEngineeringPlatform.js');
const { reliabilityEngineInstance } = require('./server/reliabilityEngine.js');
const { crossDeviceContinuityManagerInstance } = require('./server/crossDeviceContinuityManager.js');
const { maintenanceCompatibilityEngineInstance } = require('./server/maintenanceCompatibilityEngine.js');
const { serverAuthManagerInstance } = require('./server/serverAuthManager.js');
const { unifiedIntelligenceLayerInstance, TASK_CATEGORIES, GROUNDING_LEVELS } = require('./server/unifiedIntelligenceLayer.js');
const { experimentFactoryInstance } = require('./server/experimentFactory.js');
const { forecastingEngineInstance } = require('./server/forecastingEngine.js');
const { goalGuardianInstance } = require('./server/goalGuardian.js');
const { experimentSchedulerInstance } = require('./server/experimentScheduler.js');
const { futureCapabilitiesLabInstance } = require('./server/futureCapabilitiesLab.js');
const { futureCapabilityRegistryInstance } = require('./server/futureCapabilityRegistry.js');
const { worldModelEngineInstance } = require('./server/worldModelEngine.js');
const { advancedEngineeringLabInstance } = require('./server/advancedEngineeringLab.js');
const { humanInterfaceLabInstance } = require('./server/humanInterfaceLab.js');
const { missionControlEngineInstance } = require('./server/missionControlEngine.js');
const { autonomousExecutionEngineInstance } = require('./server/autonomousExecutionEngine.js');
const { screenObservationServiceInstance } = require('./server/vision/screenObservationService.js');
const { visualSimulationLauncherInstance } = require('./server/science/visualSimulationLauncher.js');
const { imageGenerationEngineInstance } = require('./server/vision/imageGenerationEngine.js');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'text/plain; charset=UTF-8',
  '.stl': 'application/octet-stream'
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10e6) { // 10MB limit for audio streams
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function getCorsOrigin(req) {
  const origin = req ? req.headers['origin'] : null;
  if (!origin) return 'http://127.0.0.1:3000';
  if (serverAuthManagerInstance.isTrustedOrigin(origin)) {
    return origin;
  }
  return 'null';
}

function sendJson(res, statusCode, data, req = null) {
  const request = req || res.req;
  const origin = getCorsOrigin(request);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Stark-Auth-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function requireAuth(req, res) {
  const auth = serverAuthManagerInstance.verifyRequest(req);
  if (!auth.authenticated) {
    sendJson(res, 401, {
      error: 'UNAUTHORIZED: Valid session token or credentials required.',
      code: 'AUTH_REQUIRED',
      reason: auth.reason || 'MISSING_OR_INVALID_CREDENTIALS'
    }, req);
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight with strict origin validation
  if (req.method === 'OPTIONS') {
    const origin = getCorsOrigin(req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Stark-Auth-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Session Authentication & Token Negotiation (Loopback Only)
  if (pathname === '/api/auth/session' && req.method === 'GET') {
    const clientIp = req.socket?.remoteAddress;
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || !clientIp;
    if (!isLoopback) {
      return sendJson(res, 403, { error: 'Access restricted to loopback interface' }, req);
    }
    if (req.headers['origin'] && !serverAuthManagerInstance.isTrustedOrigin(req.headers['origin'])) {
      return sendJson(res, 403, { error: 'Untrusted origin' }, req);
    }
    const token = serverAuthManagerInstance.getSessionToken();
    res.setHeader('Set-Cookie', serverAuthManagerInstance.createSessionCookieHeader());
    return sendJson(res, 200, { authenticated: true, token }, req);
  }

  // =========================================================================
  // API ROUTING
  // =========================================================================

  // 1. POST /api/chat — Dual AI Conversation & Tool Execution
  if (pathname === '/api/chat' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, {
        error: 'EMERGENCY_STOP_ACTIVE: Operations and AI responses are halted by the global emergency stop.',
        emergencyStopActive: true,
        reason: emergencyStopControllerInstance.getStatus().reason
      }, req);
    }

    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      let message = String(body.message || '').trim();

      if (!message && attachments.length > 0) {
        message = 'Please analyze this attached file in detail. Read all visible text, error messages, code, or content. Identify any issues, bugs, or anomalies, and explain what is wrong and how to fix it.';
      } else if (!message) {
        return sendJson(res, 400, { error: 'Message cannot be empty.' }, req);
      }

      // Add to conversation history
      conversationManagerInstance.addMessage(personality, 'user', message);
      const history = conversationManagerInstance.getHistory(personality);

      const providerMode = body.providerMode || body.modelOverride || body.model || 'auto';
      // Process interaction via Unified Intelligence Layer (understanding, context, routing, tools, verification, evidence)
      const result = await unifiedIntelligenceLayerInstance.processInteraction({
        personality,
        message,
        history,
        attachments,
        options: { modelOverride: body.model, providerMode, attachments }
      });

      // Record assistant reply in history
      conversationManagerInstance.addMessage(personality, 'assistant', result.reply, { toolResult: result.toolResult });

      const activeLang = result.language || languageVoiceManagerInstance.getLanguage(personality);
      return sendJson(res, 200, {
        reply: result.reply,
        personality: result.personality,
        language: activeLang,
        provider: result.provider,
        providerUsed: result.providerUsed || result.provider,
        providerRequested: result.providerRequested || providerMode,
        fallbackUsed: Boolean(result.fallbackUsed),
        fallbackReason: result.fallbackReason || null,
        comparison: result.comparison || null,
        emotionalState: result.emotionalState || null,
        voiceProsody: result.voiceProsody || null,
        category: result.category,
        toolResult: result.toolResult || null,
        toolResults: result.toolResults || (result.toolResult ? [result.toolResult] : []),
        evidence: result.evidence || [],
        taskLedger: result.taskLedger || null,
        latencyMs: result.latencyMs || null
      }, req);
    } catch (err) {
      console.error('[API_CHAT] Error:', err);
      const diag = errorDiagnostics.record(err, { subsystem: 'chat', query: body?.query, personality });
      const fallbackReply = personality === 'ULTRON'
        ? `Processing exception [${diag.code}]: ${diag.technicalDetail}. Local diagnostic and security tools operational.`
        : diag.spokenExplanation;
      return sendJson(res, 200, {
        reply: fallbackReply,
        personality,
        provider: 'error_diagnostics',
        error: err.message,
        diagnostics: diag
      }, req);
    }
  }

  // 1b. POST /api/chat/stream — Progressive Sentence-Streaming & Low-Latency Audio Delivery
  if (pathname === '/api/chat/stream' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, {
        error: 'EMERGENCY_STOP_ACTIVE: Streaming and tool execution are halted by the global emergency stop.',
        emergencyStopActive: true,
        reason: emergencyStopControllerInstance.getStatus().reason
      }, req);
    }

    const tReqStart = performance.now();
    let personality = 'JARVIS';
    try {
      const body = await parseJsonBody(req);
      personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      let message = String(body.message || '').trim();
      const timings = body.timings || {};

      if (!message && attachments.length > 0) {
        message = 'Please analyze this attached file in detail. Read all visible text, error messages, code, or content. Identify any issues, bugs, or anomalies, and explain what is wrong and how to fix it.';
      } else if (!message) {
        return sendJson(res, 400, { error: 'Message cannot be empty.' });
      }

      conversationManagerInstance.addMessage(personality, 'user', message);
      const history = conversationManagerInstance.getHistory(personality);

      if (req.socket) {
        req.socket.setNoDelay(true);
      }

      const corsOrigin = getCorsOrigin(req);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=UTF-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Stark-Auth-Token'
      });
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      let isAborted = false;
      const abortController = new AbortController();
      const unregisterStream = emergencyStopControllerInstance.registerStreamAbortController(abortController);

      // Keepalive heartbeat every 2.5s prevents socket idle timeouts during long tool operations (e.g. Word automation)
      const keepaliveTimer = setInterval(() => {
        if (!res.writableEnded && !isAborted) {
          try {
            res.write(':keepalive\n\n');
          } catch (_) {}
        }
      }, 2500);

      const cleanup = () => {
        clearInterval(keepaliveTimer);
        if (!isAborted) {
          isAborted = true;
          abortController.abort();
        }
        if (typeof unregisterStream === 'function') {
          try { unregisterStream(); } catch (e) {}
        }
      };

      res.on('close', () => {
        if (!res.writableEnded) {
          cleanup();
        }
      });
      res.on('finish', cleanup);

      const sendEvent = (event, data) => {
        if (isAborted) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      await unifiedIntelligenceLayerInstance.processInteractionStream({
        personality,
        message,
        history,
        attachments,
        options: { timings, attachments, modelOverride: body.providerMode || body.modelOverride || body.model },
        abortSignal: abortController.signal,
        onToolStart: (toolName, args) => {
          sendEvent('tool', { toolName, args, status: 'executing' });
        },
        onToolResult: (toolName, toolResult) => {
          sendEvent('tool', { toolName, toolResult, status: 'complete' });
        },
        onToken: (token) => {
          sendEvent('token', { token });
        },
        onSentence: (sentence, index, meta) => {
          const nowTs = performance.now();
          const activeLang = meta?.language || languageVoiceManagerInstance.getLanguage(personality);
          sendEvent('sentence', {
            sentence,
            index,
            language: activeLang,
            tFirstChunkMs: meta?.firstChunkTime ? Math.round(meta.firstChunkTime - tReqStart) : undefined,
            tFirstTokenMs: meta?.firstTokenTime ? Math.round(meta.firstTokenTime - tReqStart) : undefined,
            tSentenceFormedMs: meta?.firstSentenceTime ? Math.round(meta.firstSentenceTime - tReqStart) : undefined,
            tSseWrittenMs: Math.round(nowTs - tReqStart)
          });
        },
        onDone: (result) => {
          conversationManagerInstance.addMessage(personality, 'assistant', result.fullReply);
          const activeLang = result.language || languageVoiceManagerInstance.getLanguage(personality);
          sendEvent('done', {
            ...result,
            language: activeLang,
            tCompletedMs: Math.round(performance.now() - tReqStart)
          });
          cleanup();
          res.end();
        },
        onError: (err) => {
          sendEvent('error', { error: err.message });
          cleanup();
          res.end();
        }
      });
    } catch (err) {
      console.error('[API_CHAT_STREAM] Error:', err);
      const diag = errorDiagnostics.record(err, { subsystem: 'chat_stream' });
      if (!res.headersSent) {
        return sendJson(res, 500, { error: err.message, diagnostics: diag });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message, diagnostics: diag })}\n\n`);
        res.end();
      }
    }
    return;
  }

  // =========================================================================
  // UNIFIED INTELLIGENCE LAYER REST ENDPOINTS
  // =========================================================================

  // POST /api/intelligence/task — Create and execute an explicit multi-step task with DAG decomposition & verification
  if (pathname === '/api/intelligence/task' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, { error: 'EMERGENCY_STOP_ACTIVE: Tasks are halted by global emergency stop.' }, req);
    }
    try {
      const body = await parseJsonBody(req);
      const goal = String(body.goal || body.instruction || '').trim();
      if (!goal) return sendJson(res, 400, { error: 'Task goal is required.' }, req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const plan = unifiedIntelligenceLayerInstance.createTaskPlan({
        goal,
        category: body.category || null,
        constraints: body.constraints || {}
      });
      const executed = await unifiedIntelligenceLayerInstance.executeTaskPlan(plan, { personality });
      return sendJson(res, 200, {
        success: executed.status === 'COMPLETED',
        taskId: executed.taskId,
        status: executed.status,
        taskLedger: executed
      }, req);
    } catch (err) {
      return sendJson(res, 500, { error: err.message }, req);
    }
  }

  // GET /api/intelligence/tasks — List all active and historical task ledgers
  if (pathname === '/api/intelligence/tasks' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    const limit = parseInt(urlObj.searchParams.get('limit') || '20', 10);
    return sendJson(res, 200, { success: true, tasks: unifiedIntelligenceLayerInstance.listTaskLedgers(limit) }, req);
  }

  // GET /api/intelligence/tasks/:taskId — Retrieve a specific task ledger & checkpoints
  if (pathname.startsWith('/api/intelligence/tasks/') && req.method === 'GET' && !pathname.endsWith('/cancel')) {
    if (!requireAuth(req, res)) return;
    const taskId = pathname.replace('/api/intelligence/tasks/', '');
    const ledger = unifiedIntelligenceLayerInstance.getTaskLedger(taskId);
    if (!ledger) return sendJson(res, 404, { error: `Task "${taskId}" not found.` }, req);
    return sendJson(res, 200, { success: true, task: ledger }, req);
  }

  // POST /api/intelligence/tasks/:taskId/cancel — Cancel an in-flight task
  if (pathname.startsWith('/api/intelligence/tasks/') && pathname.endsWith('/cancel') && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    const taskId = pathname.replace('/api/intelligence/tasks/', '').replace('/cancel', '');
    const cancelRes = unifiedIntelligenceLayerInstance.cancelTask(taskId, 'User requested cancellation via API');
    return sendJson(res, cancelRes.success ? 200 : 404, cancelRes, req);
  }

  // GET /api/intelligence/preferences — Inspect user preferences
  if (pathname === '/api/intelligence/preferences' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, preferences: unifiedIntelligenceLayerInstance.getPreferences() }, req);
  }

  // POST /api/intelligence/preferences — Update user preferences
  if (pathname === '/api/intelligence/preferences' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const updated = unifiedIntelligenceLayerInstance.setPreferences(body);
      return sendJson(res, 200, updated, req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }, req);
    }
  }

  // DELETE /api/intelligence/preferences — Reset user preferences to defaults
  if (pathname === '/api/intelligence/preferences' && req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    const reset = unifiedIntelligenceLayerInstance.resetPreferences();
    return sendJson(res, 200, reset, req);
  }

  // GET /api/intelligence/metrics — Continuous evaluation metrics (latency, tasks, tools, recovery)
  if (pathname === '/api/intelligence/metrics' && req.method === 'GET') {
    return sendJson(res, 200, unifiedIntelligenceLayerInstance.getEvaluationReport(), req);
  }

  // GET /api/intelligence/modules — Complete 25-Module Master Intelligence Specification Audit
  if (pathname === '/api/intelligence/modules' && req.method === 'GET') {
    const { masterIntelligenceIntegration } = require('./server/masterIntelligenceIntegration.js');
    return sendJson(res, 200, masterIntelligenceIntegration.getComplete25ModuleReport(), req);
  }

  // GET /api/intelligence/engines — 6 Logical Intelligence Engines Status & Capabilities
  if (pathname === '/api/intelligence/engines' && req.method === 'GET') {
    const { masterIntelligenceIntegration } = require('./server/masterIntelligenceIntegration.js');
    return sendJson(res, 200, {
      success: true,
      engines: {
        languageEngine: { name: masterIntelligenceIntegration.languageEngine.name, modules: masterIntelligenceIntegration.languageEngine.modules, description: masterIntelligenceIntegration.languageEngine.description },
        reasoningEngine: { name: masterIntelligenceIntegration.reasoningEngine.name, modules: masterIntelligenceIntegration.reasoningEngine.modules, description: masterIntelligenceIntegration.reasoningEngine.description },
        memoryEngine: { name: masterIntelligenceIntegration.memoryEngine.name, modules: masterIntelligenceIntegration.memoryEngine.modules, description: masterIntelligenceIntegration.memoryEngine.description },
        knowledgeEngine: { name: masterIntelligenceIntegration.knowledgeEngine.name, modules: masterIntelligenceIntegration.knowledgeEngine.modules, description: masterIntelligenceIntegration.knowledgeEngine.description },
        learningEngine: { name: masterIntelligenceIntegration.learningEngine.name, modules: masterIntelligenceIntegration.learningEngine.modules, description: masterIntelligenceIntegration.learningEngine.description },
        toolEngine: { name: masterIntelligenceIntegration.toolEngine.name, modules: masterIntelligenceIntegration.toolEngine.modules, description: masterIntelligenceIntegration.toolEngine.description }
      }
    }, req);
  }

  // POST /api/intelligence/decision — Module 20 Multi-Criteria Decision Making Engine
  if (pathname === '/api/intelligence/decision' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { decisionMakingEngineInstance } = require('./server/decisionMakingEngine.js');
      const decision = decisionMakingEngineInstance.evaluateOptions(body);
      return sendJson(res, 200, { success: true, decision }, req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }, req);
    }
  }

  // GET /api/diagnostics/errors — Workstream I: Structured Error Ledger & Root-Cause Reporting
  if (pathname === '/api/diagnostics/errors' && req.method === 'GET') {
    const limit = parseInt(url.searchParams?.get('limit') || '20', 10);
    return sendJson(res, 200, { success: true, errors: errorDiagnostics.getRecentErrors(limit) }, req);
  }

  // POST /api/diagnostics/resolve — Workstream I: Resolve/acknowledge an error from ledger
  if (pathname === '/api/diagnostics/resolve' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const ok = errorDiagnostics.resolveError(body.errorId);
      return sendJson(res, 200, { success: ok, errorId: body.errorId }, req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }, req);
    }
  }

  // GET /api/screen-observation/status — Privacy-first user-controlled screen observation status
  if (pathname === '/api/screen-observation/status' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, ...screenObservationServiceInstance.getStatus() }, req);
  }

  // POST /api/screen-observation/toggle — Explicitly enable, pause, or disable Screen Observation Mode
  if (pathname === '/api/screen-observation/toggle' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const action = String(body.action || 'enable').toLowerCase().trim();
      let result;
      if (action === 'pause') result = screenObservationServiceInstance.pauseObservation();
      else if (action === 'disable' || action === 'stop' || action === 'off') result = await screenObservationServiceInstance.disableObservation(body.reason);
      else result = await screenObservationServiceInstance.enableObservation({
        reason: body.reason || 'User granted screen observation consent',
        scope: body.scope || 'CONTINUOUS'
      });
      return sendJson(res, 200, { ...result, ...screenObservationServiceInstance.getStatus() }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/screen-observation/inspect — Grounded foreground window & screen inspection
  if (pathname === '/api/screen-observation/inspect' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const result = await screenObservationServiceInstance.inspectScreen(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // POST /api/assistant-mode — Switch between COMMAND | CONVERSATION | PROACTIVE | QUIET
  if (pathname === '/api/assistant-mode' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const result = screenObservationServiceInstance.setAssistantMode(body.mode);
      return sendJson(res, 200, { ...result, ...screenObservationServiceInstance.getStatus() }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // GET /api/mission-control/status — Workstream J: Unified Mission Control telemetry across all systems
  if (pathname === '/api/mission-control/status' && req.method === 'GET') {
    try {
      const recentErrors = errorDiagnostics.getRecentErrors(5);
      const winList = await desktopControllerInstance.listOpenWindows().catch(() => ({ windows: [], foregroundWindow: null }));
      const activeWindows = winList.windows || [];
      const chromeProfiles = chromeProfileService.getProfiles();
      const spotifyStatus = await spotifyController.getStatus();
      const callState = whatsappServiceInstance.getCallState();
      const obsStatus = screenObservationServiceInstance.getStatus();
      const latestSim = visualSimulationLauncherInstance.getLatestSimulation();
      const webIntelStatus = liveWebResearchService.getConnectivityStatus();
      
      const payload = {
        success: true,
        timestamp: new Date().toISOString(),
        system: {
          emergencyStop: emergencyStopControllerInstance.isEngaged(),
          activeWindowsCount: activeWindows.length,
          foregroundWindow: winList.foregroundWindow || null,
          activeWindows: activeWindows.slice(0, 8),
          screenObservation: obsStatus,
          assistantMode: obsStatus.assistantMode,
          unresolvedErrorsCount: recentErrors.filter(e => !e.resolved).length,
          lastError: recentErrors[0] || null
        },
        subsystems: {
          webIntelligence: webIntelStatus,
          spotify: spotifyStatus,
          whatsapp: {
            callState,
            contactsCount: whatsappServiceInstance.contacts ? whatsappServiceInstance.contacts.length : 0
          },
          chrome: {
            profilesCount: chromeProfiles.length,
            profiles: chromeProfiles.map(p => ({ dir: p.dir, name: p.name, email: p.email }))
          },
          models3D: {
            activeCount: universal3dEngine.listModels().length
          },
          simulations: {
            activeCount: visualSimulationLauncherInstance.activeSimulations.size,
            latestSimulation: latestSim ? { simId: latestSim.simId, type: latestSim.simulationType, title: latestSim.title } : null
          }
        }
      };
      return sendJson(res, 200, payload, req);
    } catch (err) {
      return sendJson(res, 500, { error: err.message }, req);
    }
  }

  // GET /api/web-intelligence/status — Live Internet, Web Search, Browser & Research Engine Connectivity
  if (pathname === '/api/web-intelligence/status' && req.method === 'GET') {
    try {
      return sendJson(res, 200, { success: true, ...liveWebResearchService.getConnectivityStatus() }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // POST /api/web-intelligence/health-check — Active Live Internet & Provider Re-Probe
  if (pathname === '/api/web-intelligence/health-check' && req.method === 'POST') {
    try {
      const status = await liveWebResearchService.refreshConnectionHealth({ force: true });
      return sendJson(res, 200, { success: true, ...status }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // GET /api/news/live — Normalized Live Latest News Endpoint (Independent of LLM)
  if (pathname === '/api/news/live' && req.method === 'GET') {
    try {
      const topic = urlObj.searchParams.get('topic') || 'technology';
      const source = urlObj.searchParams.get('source') || '';
      const maxResults = Math.min(12, Math.max(1, parseInt(urlObj.searchParams.get('maxResults') || '6', 10) || 6));
      const fresh = urlObj.searchParams.get('fresh') === '1' || urlObj.searchParams.get('fresh') === 'true';
      const data = await liveWebResearchService.getLiveNews(topic, maxResults, { fresh, source });
      return sendJson(res, 200, data, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, articles: [], count: 0, error: err.message }, req);
    }
  }

  // POST /api/news/summarize — Summarize & Explain Retrieved Article via VISION or Gemini
  if (pathname === '/api/news/summarize' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const articleUrl = String(body.articleUrl || body.url || '').trim();
      const headline = String(body.headline || body.title || '').trim();
      const source = String(body.source || 'News Outlet').trim();
      const publishedAt = String(body.publishedAt || body.publishedDisplay || '').trim();
      const snippet = String(body.summary || body.snippet || '').trim();
      const providerMode = body.providerMode || 'auto';
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';

      if (!headline && !articleUrl) {
        return sendJson(res, 400, { success: false, error: 'articleUrl or headline is required.' }, req);
      }

      let extractedBody = '';
      let fetchedFullText = false;
      if (articleUrl && !/news\.google\.com\/(?:rss\/)?articles\//i.test(articleUrl)) {
        try {
          const fetched = await liveWebResearchService.fetchWebArticle(articleUrl, { timeoutMs: 7000, useBrowserFallback: false });
          if (fetched && fetched.success && fetched.textSample) {
            extractedBody = String(fetched.textSample).slice(0, 2600);
            fetchedFullText = true;
          }
        } catch (_) {}
      }

      const groundingData = {
        toolName: 'fetch_web_article',
        success: true,
        headline,
        source,
        publishedAt,
        url: articleUrl,
        extractedText: extractedBody || snippet,
        summary: `${headline} (${source}, ${publishedAt || 'recent'}): ${(extractedBody || snippet).slice(0, 600)}`
      };

      const prompt = `Summarize this real news article concisely in 3 clear sentences or bullet points based ONLY on the retrieved article data below. Do NOT invent any extra facts, dates, quotes, or URLs.\n\nHeadline: ${headline}\nSource: ${source}\nPublished: ${publishedAt || 'N/A'}\nURL: ${articleUrl || 'N/A'}\nContent:\n${extractedBody || snippet}`;
      const aiRes = await aiAdapterInstance.generateResponse(personality, prompt, [], groundingData, [], { providerMode });
      return sendJson(res, 200, {
        success: true,
        headline,
        source,
        articleUrl,
        fetchedFullText,
        provider: aiRes.provider,
        providerUsed: aiRes.providerUsed || aiRes.provider,
        summaryText: aiRes.reply,
        comparison: aiRes.comparison || null,
        latencyMs: aiRes.latencyMs || null
      }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // POST /api/intelligence/classify — Classify request into one of 12 categories
  if (pathname === '/api/intelligence/classify' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const text = String(body.message || body.text || '').trim();
      const classification = unifiedIntelligenceLayerInstance.classifyTask(text);
      return sendJson(res, 200, { success: true, classification }, req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }, req);
    }
  }

  // POST /api/intelligence/research — Deep academic research with citation provenance
  if (pathname === '/api/intelligence/research' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const query = String(body.query || '').trim();
      if (!query) return sendJson(res, 400, { error: 'Query is required.' }, req);
      const maxResults = parseInt(body.maxResults || '5', 10);
      const papers = await advancedResearchEngineInstance.searchScientificPapers(query, maxResults);
      return sendJson(res, 200, { success: true, query, papers }, req);
    } catch (err) {
      return sendJson(res, 500, { error: err.message }, req);
    }
  }

  // POST /api/intelligence/agent — Dispatch specialist agent task
  if (pathname === '/api/intelligence/agent' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const roleId = String(body.roleId || '').trim();
      if (!roleId) return sendJson(res, 400, { error: 'roleId is required.' }, req);
      const agentRes = await unifiedIntelligenceLayerInstance.executeSpecialistAgent(roleId, body.taskInput || {});
      return sendJson(res, 200, { success: true, agentResult: agentRes }, req);
    } catch (err) {
      return sendJson(res, 500, { error: err.message }, req);
    }
  }

  // 1c. GET /api/latency/metrics — Statistical Latency Breakdown (Median, P95, Mean, Min, Max)
  if (pathname === '/api/latency/metrics' && req.method === 'GET') {
    return sendJson(res, 200, latencyTrackerInstance.getStats());
  }

  // 1d. GET /api/latency/history — Granular Non-Sensitive Request Timing History
  if (pathname === '/api/latency/history' && req.method === 'GET') {
    const limit = parseInt(urlObj.searchParams.get('limit') || '25', 10);
    return sendJson(res, 200, latencyTrackerInstance.getHistory(limit));
  }

  // 1e. POST /api/latency/record — Client Playback Timestamp Telemetry
  if (pathname === '/api/latency/record' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const entry = latencyTrackerInstance.record(payload);
      return sendJson(res, 200, { success: true, entryId: entry.id });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 2. GET /api/diagnostics or /api/system/health — Real Windows Live Telemetry
  if ((pathname === '/api/diagnostics' || pathname === '/api/system/health') && req.method === 'GET') {
    try {
      const telemetry = await collectSystemDiagnostics();
      return sendJson(res, 200, { status: 'healthy', ...telemetry });
    } catch (err) {
      console.error('[API_DIAGNOSTICS] Error:', err);
      return sendJson(res, 500, { status: 'unhealthy', error: err.message });
    }
  }

  // 3. POST /api/analyze-code — Static Vulnerability & Code Review
  if (pathname === '/api/analyze-code' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const code = String(body.code || '');
      const filename = String(body.filename || 'snippet.js');
      const analysis = analyzeCode(code, filename);
      return sendJson(res, 200, analysis);
    } catch (err) {
      console.error('[API_ANALYZE_CODE] Error:', err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. GET /api/status — Backend Health & Configured Providers
  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'OPERATIONAL',
      uptimeSec: process.uptime(),
      providers: aiAdapterInstance.getProviderStatus(),
      timeContext: timeServiceInstance.getCurrentTime(),
      timestamp: new Date().toISOString()
    });
  }

  // 4b. GET /api/time — Deterministic Local Time, Timezone, Category & Context-Aware Greeting
  if (pathname === '/api/time' && req.method === 'GET') {
    try {
      const customDateStr = urlObj.searchParams.get('date');
      const customDate = customDateStr ? new Date(customDateStr) : null;
      const timeData = timeServiceInstance.getCurrentTime(customDate);
      const personality = (urlObj.searchParams.get('personality') === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const isResumedSession = urlObj.searchParams.get('isResumedSession') === 'true';
      const hasTaskImmediately = urlObj.searchParams.get('hasTaskImmediately') === 'true';
      const language = urlObj.searchParams.get('language') || 'en';
      const greeting = timeServiceInstance.getNaturalGreeting(personality, {
        date: customDate,
        isResumedSession,
        hasTaskImmediately,
        language
      });
      return sendJson(res, 200, {
        success: true,
        ...timeData,
        boundaries: timeServiceInstance.getTimeCategoryBoundaries(),
        greeting
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 4c. POST /api/time/boundaries — Configure Custom Time-of-Day Boundaries
  if (pathname === '/api/time/boundaries' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const updated = timeServiceInstance.setTimeCategoryBoundaries(body);
      return sendJson(res, 200, {
        success: true,
        boundaries: updated
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 4d. POST /api/time/greeting — Context-Aware Natural Greeting Generator
  if (pathname === '/api/time/greeting' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const greeting = timeServiceInstance.getNaturalGreeting(personality, {
        date: body.date ? new Date(body.date) : null,
        category: body.category,
        isResumedSession: body.isResumedSession,
        hasTaskImmediately: body.hasTaskImmediately,
        language: body.language
      });
      return sendJson(res, 200, {
        success: true,
        personality,
        greeting
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 5. POST /api/reset-conversation — Clear History
  if (pathname === '/api/reset-conversation' && req.method === 'POST') {
    conversationManagerInstance.clearHistory();
    return sendJson(res, 200, { success: true, message: 'Conversation histories cleared.' });
  }

  // 5b. GET /api/conversation/history — Retrieve Stored Conversation History
  if (pathname === '/api/conversation/history' && req.method === 'GET') {
    const personality = (urlObj.searchParams.get('personality') === 'ULTRON') ? 'ULTRON' : 'JARVIS';
    return sendJson(res, 200, {
      personality,
      history: conversationManagerInstance.getHistory(personality)
    });
  }

  // 5c. GET /api/conversation/export — Export Full Session With Turns & Summaries
  if (pathname === '/api/conversation/export' && req.method === 'GET') {
    return sendJson(res, 200, conversationManagerInstance.exportSession());
  }

  // 5d. POST /api/conversation/import — Import Saved Conversation Session
  if (pathname === '/api/conversation/import' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const resData = conversationManagerInstance.importSession(body);
      return sendJson(res, 200, resData);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 5e. GET /api/models — Configured Model Hierarchy & Circuit Breaker Status
  if (pathname === '/api/models' && req.method === 'GET') {
    return sendJson(res, 200, aiAdapterInstance.getAvailableModels());
  }

  // 5f. POST /api/models/set — Runtime Model Selection
  if (pathname === '/api/models/set' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = aiAdapterInstance.setModel(body.provider, body.model);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 5g. POST /api/analyze-document — Analyze Text, Markdown, Code, CSV or Log
  if (pathname === '/api/analyze-document' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const analysis = documentAnalyzerInstance.analyzeDocument(body.target, { filename: body.filename });
      return sendJson(res, 200, analysis);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6. GET /api/config — Session & VAD Configuration from Environment / Server Defaults
  if (pathname === '/api/config' && req.method === 'GET') {
    const sessionConfig = {
      vadEnabled: process.env.VAD_ENABLED !== undefined ? (process.env.VAD_ENABLED === 'true' || process.env.VAD_ENABLED === '1') : true,
      adaptiveTimeoutEnabled: process.env.ADAPTIVE_TIMEOUT_ENABLED !== undefined ? (process.env.ADAPTIVE_TIMEOUT_ENABLED === 'true' || process.env.ADAPTIVE_TIMEOUT_ENABLED === '1') : true,
      shortPauseGraceMs: parseInt(process.env.SHORT_PAUSE_GRACE_MS, 10) || 12000,
      normalInactivityTimeoutMs: parseInt(process.env.NORMAL_INACTIVITY_TIMEOUT_MS, 10) || 45000,
      extendedThinkingTimeoutMs: parseInt(process.env.EXTENDED_THINKING_TIMEOUT_MS, 10) || 90000,
      maximumActiveSessionMs: parseInt(process.env.MAX_ACTIVE_SESSION_MS, 10) || 1800000,
      speechEndDebounceMs: parseInt(process.env.SPEECH_END_DEBOUNCE_MS, 10) || 700,
      tolerateThinkingPauses: process.env.TOLERATE_THINKING_PAUSES !== undefined ? (process.env.TOLERATE_THINKING_PAUSES === 'true' || process.env.TOLERATE_THINKING_PAUSES === '1') : true,
      waitForFollowupAnswers: process.env.WAIT_FOR_FOLLOWUP_ANSWERS !== undefined ? (process.env.WAIT_FOR_FOLLOWUP_ANSWERS === 'true' || process.env.WAIT_FOR_FOLLOWUP_ANSWERS === '1') : true
    };
    return sendJson(res, 200, { session: sessionConfig });
  }

  // 7. GET /api/memories & GET /api/memory — List & Query Persistent Personal Memories
  if ((pathname === '/api/memories' || pathname === '/api/memory') && req.method === 'GET') {
    const category = urlObj.searchParams.get('category');
    const epistemicType = urlObj.searchParams.get('epistemicType');
    const search = urlObj.searchParams.get('q');
    if (search) {
      const results = memoryManagerInstance.getRelevantMemories(search, 20);
      return sendJson(res, 200, { success: true, count: results.length, memories: results }, req);
    }
    let list = memoryManagerInstance.getMemories(category);
    if (epistemicType) {
      list = list.filter(m => (m.epistemicType || '').toUpperCase() === epistemicType.toUpperCase());
    }
    return sendJson(res, 200, { success: true, count: list.length, memories: list }, req);
  }

  // 7b. POST /api/memory — Create a new personal memory manually
  if (pathname === '/api/memory' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const fact = String(body.fact || body.text || '').trim();
      if (!fact) return sendJson(res, 400, { error: 'Memory fact text is required.' }, req);
      const result = memoryManagerInstance.addMemory(fact, body.category || 'preference', {
        epistemicType: body.epistemicType,
        source: body.source || 'manual_api_entry',
        metadata: body.metadata || {}
      });
      return sendJson(res, result.success ? 200 : 400, result, req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message }, req);
    }
  }

  // 7c. POST /api/memory/search — Relevance search with match reasons and confidence
  if (pathname === '/api/memory/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const query = String(body.query || '').trim();
      const limit = parseInt(body.limit || '5', 10);
      const matches = memoryManagerInstance.getRelevantMemories(query, limit);
      return sendJson(res, 200, { success: true, count: matches.length, matches }, req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message }, req);
    }
  }

  // 7d. PUT /api/memory/:id — Correct/update a memory
  if (pathname.startsWith('/api/memory/') && !pathname.includes('/projects') && !pathname.includes('/config') && !pathname.includes('/search') && req.method === 'PUT') {
    if (!requireAuth(req, res)) return;
    try {
      const id = pathname.replace('/api/memory/', '');
      const body = await parseJsonBody(req);
      const newFact = String(body.fact || body.newFact || '').trim();
      const updated = memoryManagerInstance.correctMemory(id, newFact);
      return sendJson(res, updated.success ? 200 : 404, updated, req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message }, req);
    }
  }

  // 7e. DELETE /api/memory/:id — Delete a single memory
  if (pathname.startsWith('/api/memory/') && !pathname.includes('/projects') && !pathname.includes('/config') && !pathname.includes('/clear') && req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    const id = pathname.replace('/api/memory/', '');
    const delRes = memoryManagerInstance.deleteMemory(id);
    return sendJson(res, delRes.success ? 200 : 404, delRes, req);
  }

  // 7f. GET & POST /api/memory/config — Inspect and toggle auto-memory saving
  if (pathname === '/api/memory/config' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, config: memoryManagerInstance.getMemoryConfig() }, req);
  }
  if (pathname === '/api/memory/config' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (body.autoMemoryEnabled !== undefined) {
        memoryManagerInstance.setAutoMemoryEnabled(body.autoMemoryEnabled);
      }
      return sendJson(res, 200, { success: true, config: memoryManagerInstance.getMemoryConfig() }, req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message }, req);
    }
  }

  // 7g. Project Memory Routes: /api/memory/projects
  if (pathname === '/api/memory/projects' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, projects: memoryManagerInstance.listProjects() }, req);
  }
  if (pathname.startsWith('/api/memory/projects/') && req.method === 'GET') {
    const name = decodeURIComponent(pathname.replace('/api/memory/projects/', ''));
    const proj = memoryManagerInstance.getProjectContext(name);
    return sendJson(res, proj.found ? 200 : 404, proj, req);
  }
  if (pathname.startsWith('/api/memory/projects/') && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const name = decodeURIComponent(pathname.replace('/api/memory/projects/', ''));
      const body = await parseJsonBody(req);
      const saved = memoryManagerInstance.saveProjectContext({ ...body, projectName: name });
      return sendJson(res, 200, saved, req);
    } catch (e) {
      return sendJson(res, 400, { error: e.message }, req);
    }
  }

  // 8. POST /api/memories/clear & DELETE /api/memory — Clear Persistent Memories
  if (((pathname === '/api/memories/clear' || pathname === '/api/memory/clear') && req.method === 'POST') ||
      (pathname === '/api/memory' && req.method === 'DELETE')) {
    if (!requireAuth(req, res)) return;
    memoryManagerInstance.clearAll();
    return sendJson(res, 200, { success: true, message: 'All personal memories cleared from persistent storage.' });
  }

  // 9. GET /api/tasks — List Persistent Tasks
  if (pathname === '/api/tasks' && req.method === 'GET') {
    const filter = urlObj.searchParams.get('filter') || 'pending';
    return sendJson(res, 200, taskManagerInstance.listTasks(filter));
  }

  // 10. POST /api/tasks — Create a Persistent Task
  if (pathname === '/api/tasks' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = taskManagerInstance.createTask(body.title, body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 11. POST /api/tasks/complete — Complete a Task
  if (pathname === '/api/tasks/complete' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = taskManagerInstance.completeTask(body.query || body.id);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 11b. POST /api/orchestration/plan — Create Structured Task Plan
  if (pathname === '/api/orchestration/plan' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const plan = taskOrchestratorInstance.createPlan(body);
      return sendJson(res, 200, { success: true, plan }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 11c. POST /api/orchestration/execute — Execute Multi-Step Task Plan
  if (pathname === '/api/orchestration/execute' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const report = await taskOrchestratorInstance.executePlan({
        ...body,
        personality
      });
      return sendJson(res, 200, { success: report.status === 'SUCCESS' || report.status === 'PARTIAL_SUCCESS', report }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // 11d. GET /api/orchestration/status — Query Task Plan Progress
  if (pathname === '/api/orchestration/status' && req.method === 'GET') {
    const planId = urlObj.searchParams.get('planId');
    if (!planId) {
      return sendJson(res, 400, { success: false, error: 'planId query parameter is required.' }, req);
    }
    const status = taskOrchestratorInstance.getPlanStatus(planId);
    return sendJson(res, 200, { success: true, ...status }, req);
  }

  // 11e. POST /api/orchestration/cancel — Abort In-Flight Task Plan
  if (pathname === '/api/orchestration/cancel' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const result = taskOrchestratorInstance.cancelPlan(body.planId);
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 11f. GET /api/orchestration/history — List Executed Task Plans
  if (pathname === '/api/orchestration/history' && req.method === 'GET') {
    const limit = urlObj.searchParams.get('limit') || 20;
    const history = taskOrchestratorInstance.listExecutedPlans(limit);
    return sendJson(res, 200, { success: true, ...history }, req);
  }

  // 12. POST /api/approval/request — Create an Action Approval Token
  if (pathname === '/api/approval/request' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const result = securityPermissionsInstance.createApprovalRequest(
        body.action,
        body.target,
        body.args || {},
        body.personality || 'JARVIS'
      );
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }, req);
    }
  }

  // 12b. POST /api/security/emergency-stop — Global Real-World Emergency Stop (<10ms across all subsystems)
  if (pathname === '/api/security/emergency-stop' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const reason = body.reason || 'User triggered global emergency stop';
      const result = emergencyStopControllerInstance.engage(reason);
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // 12c. POST /api/security/emergency-reset / emergency-stop-reset — Clear Global Emergency Stop
  if ((pathname === '/api/security/emergency-reset' || pathname === '/api/security/emergency-stop-reset') && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const reason = body.reason || 'User triggered emergency stop reset';
      const result = emergencyStopControllerInstance.reset(reason);
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // 12d. GET /api/security/emergency-status — Check Global Emergency Stop Status
  if (pathname === '/api/security/emergency-status' && req.method === 'GET') {
    return sendJson(res, 200, emergencyStopControllerInstance.getStatus(), req);
  }

  // 12d. GET /api/security/audit-log — Retrieve Redacted Audit Log
  if (pathname === '/api/security/audit-log' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    const limit = parseInt(urlObj.searchParams.get('limit'), 10) || 50;
    const logs = permissionGateInstance.getAuditLog(limit);
    return sendJson(res, 200, { success: true, count: logs.length, logs }, req);
  }

  // 12e. POST /api/latency/record — Record Granular Lifecycle Timestamps
  if (pathname === '/api/latency/record' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const entry = latencyTrackerInstance.record(body);
      return sendJson(res, 200, { success: true, entry });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 12f. GET /api/latency/stats — Retrieve Summary Latency Statistics
  if (pathname === '/api/latency/stats' && req.method === 'GET') {
    const filterSim = urlObj.searchParams.has('sim') ? (urlObj.searchParams.get('sim') === 'true') : null;
    return sendJson(res, 200, { success: true, stats: latencyTrackerInstance.getStats(filterSim) });
  }

  // 12g. GET /api/latency/report — Concise Performance Diagnostic Report
  if (pathname === '/api/latency/report' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, ...latencyTrackerInstance.getDiagnosticReport() });
  }

  // 13. POST /api/desktop/execute — Direct Desktop Action Execution with Permission Gate
  if (pathname === '/api/desktop/execute' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const action = String(body.action || '').trim();
      const args = body.args || {};

      if (!action) {
        return sendJson(res, 400, { error: 'Action cannot be empty.' });
      }

      // Execute through toolsRegistry with permission gate enforcement
      const result = await executeTool(action, args, personality);
      return sendJson(res, 200, {
        success: true,
        action,
        personality,
        result
      });
    } catch (err) {
      return sendJson(res, 403, {
        success: false,
        error: err.message
      });
    }
  }

  // 13b. POST /api/desktop/agent/command — Execute Controlled Shell Command via Windows Local Agent
  if (pathname === '/api/desktop/agent/command' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      windowsLocalAgentInstance.authenticate(req, personality);
      const result = await windowsLocalAgentInstance.executeControlledCommand({
        command: body.command,
        args: body.args,
        timeoutMs: body.timeoutMs,
        cwd: body.cwd,
        personality
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 403, { success: false, error: err.message });
    }
  }

  // 13c. POST /api/desktop/agent/workflow — Execute Desktop Workflow via Windows Local Agent
  if (pathname === '/api/desktop/agent/workflow' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      windowsLocalAgentInstance.authenticate(req, personality);
      const result = await windowsLocalAgentInstance.executeDesktopWorkflow({
        workflowType: body.workflowType,
        options: body.options || {},
        personality
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 403, { success: false, error: err.message });
    }
  }

  // 13d. GET /api/desktop/agent/status — Retrieve Local Agent Status & PIDs
  if (pathname === '/api/desktop/agent/status' && req.method === 'GET') {
    return sendJson(res, 200, windowsLocalAgentInstance.getStatus());
  }

  // 13e. GET /api/desktop/agent/audit — Retrieve Local Agent Audit Logs
  if (pathname === '/api/desktop/agent/audit' && req.method === 'GET') {
    const limit = parseInt(urlObj.searchParams.get('limit'), 10) || 50;
    return sendJson(res, 200, {
      success: true,
      logs: windowsLocalAgentInstance.getAuditLogs(limit)
    });
  }

  // 13f. POST /api/agent/lifecycle/start — Start Python Local Agent Daemon
  if (pathname === '/api/agent/lifecycle/start' && req.method === 'POST') {
    try {
      const result = await windowsLocalAgentInstance.startPythonAgent();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 13g. POST /api/agent/lifecycle/stop — Stop Python Local Agent Daemon
  if (pathname === '/api/agent/lifecycle/stop' && req.method === 'POST') {
    try {
      const result = await windowsLocalAgentInstance.stopPythonAgent();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 13h. POST /api/agent/lifecycle/restart — Restart Python Local Agent Daemon
  if (pathname === '/api/agent/lifecycle/restart' && req.method === 'POST') {
    try {
      const result = await windowsLocalAgentInstance.restartPythonAgent();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 13i. GET /api/agent/lifecycle/status — Get Python Local Agent Daemon Status
  if (pathname === '/api/agent/lifecycle/status' && req.method === 'GET') {
    try {
      const result = await windowsLocalAgentInstance.getPythonAgentStatus();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 13j. POST /api/agent/lifecycle/register — User-level Windows Startup Registration
  if (pathname === '/api/agent/lifecycle/register' && req.method === 'POST') {
    try {
      const result = windowsLocalAgentInstance.registerUserStartup();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 14. GET /api/desktop/capabilities — Capability Matrix by Active Personality
  if (pathname === '/api/desktop/capabilities' && req.method === 'GET') {
    const personality = (urlObj.searchParams.get('personality') === 'ULTRON') ? 'ULTRON' : 'JARVIS';
    const report = permissionGateInstance.getCapabilityReport(personality);
    return sendJson(res, 200, report);
  }

  // 15. GET /api/language — Language Preferences & Voice Settings
  if (pathname === '/api/language' && req.method === 'GET') {
    const personality = (urlObj.searchParams.get('personality') === 'ULTRON') ? 'ULTRON' : 'JARVIS';
    const all = languageVoiceManagerInstance.getAllPreferences();
    return sendJson(res, 200, {
      success: true,
      preferences: all.preferences,
      currentLanguage: languageVoiceManagerInstance.getLanguage(personality),
      supportedLanguages: all.supportedLanguages,
      credentials: all.credentials,
      activeVoiceConfig: languageVoiceManagerInstance.getVoiceConfigForPersonalityAndLanguage(personality)
    });
  }

  // 16. POST /api/language/set — Dynamic Language Mode Switch
  if (pathname === '/api/language/set' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const language = body.language || 'en';
      const result = languageVoiceManagerInstance.setLanguage(personality, language);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 17. GET /api/language/credentials — Safe Speech Provider Verification
  if (pathname === '/api/language/credentials' && req.method === 'GET') {
    try {
      const forceRefresh = urlObj.searchParams.get('force') === 'true';
      const verification = await languageVoiceManagerInstance.verifyCredentials(forceRefresh);
      return sendJson(res, 200, {
        success: true,
        verification,
        summary: languageVoiceManagerInstance.getMaskedCredentialsSummary()
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 18. POST /api/tts/synthesize — Speech Synthesis Bridge with Fallback
  if (pathname === '/api/tts/synthesize' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const text = String(body.text || '').trim();
      const language = body.language || languageVoiceManagerInstance.getLanguage(personality);

      const result = await languageVoiceManagerInstance.synthesizeSpeech({ text, personality, language });
      if (!result.fallback && result.audioBuffer) {
        res.writeHead(200, {
          'Content-Type': result.contentType || 'audio/mpeg',
          'Content-Length': result.audioBuffer.length,
          'X-TTS-Provider': 'fish_audio'
        });
        return res.end(result.audioBuffer);
      }

      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 19. POST /api/stt — Multilingual Audio Speech-to-Text Fallback
  if (pathname === '/api/stt' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const audio = body.audio || body.audioBase64 || '';
      const mimeType = body.mimeType || 'audio/webm;codecs=opus';
      const language = body.language || 'en';

      const result = await sttServiceInstance.transcribeAudio(audio, mimeType, language);
      return sendJson(res, 200, {
        success: true,
        ...result
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 20. GET /api/stt/status — STT Provider Availability
  if (pathname === '/api/stt/status' && req.method === 'GET') {
    const status = sttServiceInstance.getStatus();
    return sendJson(res, 200, {
      success: true,
      ...status
    });
  }

  // 21. GET /api/permissions — Granular Permission Profiles for JARVIS and ULTRON
  if (pathname === '/api/permissions' && req.method === 'GET') {
    const personality = (urlObj.searchParams.get('personality') === 'ULTRON') ? 'ULTRON' : 'JARVIS';
    const profile = permissionManagerInstance.getProfile(personality);
    return sendJson(res, 200, {
      success: true,
      personality,
      profile
    });
  }

  // 22. POST /api/permissions/set — Toggle Granular Permission
  if (pathname === '/api/permissions/set' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = permissionManagerInstance.setPermission(body.permissionId, body.enabled, personality);
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 23. POST /api/permissions/trusted-mode — Toggle Trusted Mode for Reversible Actions
  if (pathname === '/api/permissions/trusted-mode' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = permissionManagerInstance.setTrustedMode(body.enabled, personality);
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 24. POST /api/permissions/folder/add — Add Permitted Folder Grant
  if (pathname === '/api/permissions/folder/add' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = permissionManagerInstance.addPermittedFolder(body.folderPath, personality);
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 25. POST /api/permissions/folder/remove — Remove Permitted Folder Grant
  if (pathname === '/api/permissions/folder/remove' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = permissionManagerInstance.removePermittedFolder(body.folderPath, personality);
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 26. POST /api/permissions/test/:permissionId — Live Verification of Capability
  if (pathname.startsWith('/api/permissions/test/') && req.method === 'POST') {
    try {
      const permissionId = pathname.replace('/api/permissions/test/', '').trim();
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = await permissionManagerInstance.testCapability(permissionId, personality);
      return sendJson(res, 200, { success: result.success !== false, result });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 27. GET /api/whatsapp/status — WhatsApp Service State & Contacts
  if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
    const status = whatsappServiceInstance.getServiceStatus();
    return sendJson(res, 200, { success: true, ...status });
  }

  // 28. POST /api/whatsapp/open — Launch WhatsApp
  if (pathname === '/api/whatsapp/open' && req.method === 'POST') {
    try {
      const result = await whatsappServiceInstance.openWhatsApp();
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 29. POST /api/whatsapp/conversation — Open Contact Conversation
  if (pathname === '/api/whatsapp/conversation' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await whatsappServiceInstance.openConversation(body.contact);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 30. POST /api/whatsapp/draft — Draft Message Before Sending
  if (pathname === '/api/whatsapp/draft' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = whatsappServiceInstance.draftMessage(body.contact, body.messageText);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 31. POST /api/whatsapp/send — Dispatch Approved Message
  if (pathname === '/api/whatsapp/send' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const userConfirmed = body.userConfirmed !== false;
      const result = await whatsappServiceInstance.sendMessage(body.target, body.messageText, userConfirmed);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 32. POST /api/whatsapp/call/start — Prepare & Initiate Audio Call
  if (pathname === '/api/whatsapp/call/start' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const userConfirmed = Boolean(body.userConfirmed);
      const result = await whatsappServiceInstance.initiateCall(body.contact, userConfirmed);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 33. POST /api/whatsapp/call/end — Terminate Ongoing Call
  if (pathname === '/api/whatsapp/call/end' && req.method === 'POST') {
    const result = await whatsappServiceInstance.endCall();
    return sendJson(res, 200, result);
  }

  // 34. GET /api/whatsapp/call/state — Get Live Call State
  if (pathname === '/api/whatsapp/call/state' && req.method === 'GET') {
    const state = whatsappServiceInstance.getCallState();
    return sendJson(res, 200, { success: true, callState: state });
  }

  // 34b. GET /api/whatsapp/messages — Read Recent Messages using Windows OCR
  if (pathname === '/api/whatsapp/messages' && req.method === 'GET') {
    const contact = urlObj.searchParams.get('contact') || '';
    const result = await whatsappServiceInstance.readRecentMessages(contact);
    return sendJson(res, 200, result);
  }

  // 34c. POST /api/desktop/volume — Live System & Call Volume Adjustment
  if (pathname === '/api/desktop/volume' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = body.action || body.direction || 'volumeup';
      const steps = parseInt(body.steps, 10) || 2;
      const result = await whatsappServiceInstance.adjustVolume(action, steps);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 34d. POST /api/voice/relay/speak — Dictated Voice Relay ("dicto me")
  if (pathname === '/api/voice/relay/speak' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await conversationalRelayServiceInstance.speakAsUser(body.message || body.text || '');
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 34e. GET /api/voice/relay/status — Voice Relay Proxy State
  if (pathname === '/api/voice/relay/status' && req.method === 'GET') {
    const status = conversationalRelayServiceInstance.getStatus();
    return sendJson(res, 200, { success: true, status }, req);
  }

  // 34f. GET /api/voice/state — Canonical Voice State & Session Timer Telemetry
  if (pathname === '/api/voice/state' && req.method === 'GET') {
    const voiceStatus = fullDuplexVoiceEngineInstance.getStatus();
    const wakeMetrics = wakeWordDetectorInstance.getMetrics();
    return sendJson(res, 200, {
      success: true,
      ...voiceStatus,
      wakeWord: wakeMetrics,
      emergencyStopActive: emergencyStopControllerInstance.isEngaged()
    }, req);
  }

  // 34g. POST /api/voice/state — Sync Canonical Frontend Voice State Telemetry
  if (pathname === '/api/voice/state' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const status = fullDuplexVoiceEngineInstance.syncClientState(body || {});
      if (body && body.voiceMode !== undefined) {
        wakeWordDetectorInstance.setEnabled(String(body.voiceMode).toUpperCase() === 'WAKE_WORD');
      }
      return sendJson(res, 200, { success: true, ...status }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 34h. POST /api/voice/mode — Explicitly Set Voice Activation Mode (DISABLED | PUSH_TO_TALK | WAKE_WORD | CONTINUOUS)
  if (pathname === '/api/voice/mode' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const status = fullDuplexVoiceEngineInstance.setMode(body.mode || 'DISABLED', body.reason || 'API_MODE_CHANGE');
      wakeWordDetectorInstance.setEnabled(status.voiceMode === 'WAKE_WORD');
      return sendJson(res, 200, { success: true, ...status }, req);
    } catch (err) {
      const code = String(err.message || '').includes('EMERGENCY_STOP_ACTIVE') ? 423 : 400;
      return sendJson(res, code, { success: false, error: err.message }, req);
    }
  }

  // 34i. POST /api/voice/session/start — Start Active Voice Capture Session
  if (pathname === '/api/voice/session/start' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      if (body.mode) {
        fullDuplexVoiceEngineInstance.setMode(body.mode, 'API_SESSION_START_MODE');
      }
      const resSession = fullDuplexVoiceEngineInstance.startSession({
        personality: body.personality || 'JARVIS',
        preserveExistingSession: body.preserveExistingSession !== false,
        reason: body.reason || 'API_EXPLICIT_START'
      });
      return sendJson(res, 200, { ...resSession, ...fullDuplexVoiceEngineInstance.getStatus() }, req);
    } catch (err) {
      const code = String(err.message || '').includes('EMERGENCY_STOP_ACTIVE') ? 423 : 400;
      return sendJson(res, code, { success: false, error: err.message }, req);
    }
  }

  // 34j. POST /api/voice/session/stop — Stop Active Capture Session & Reset Timer
  if (pathname === '/api/voice/session/stop' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const status = fullDuplexVoiceEngineInstance.endListeningSession(body.reason || 'API_SESSION_STOP');
      return sendJson(res, 200, { success: true, ...status }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 34k. POST /api/voice/session/pause — Pause Voice Interaction & Release Mic
  if (pathname === '/api/voice/session/pause' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const status = fullDuplexVoiceEngineInstance.pause(body.reason || 'API_SESSION_PAUSE');
      return sendJson(res, 200, { success: true, ...status }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 34l. POST /api/voice/session/resume — Resume Voice Interaction into READY
  if (pathname === '/api/voice/session/resume' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const status = fullDuplexVoiceEngineInstance.resume(body.reason || 'API_SESSION_RESUME');
      return sendJson(res, 200, { success: true, ...status }, req);
    } catch (err) {
      const code = String(err.message || '').includes('EMERGENCY_STOP_ACTIVE') ? 423 : 400;
      return sendJson(res, code, { success: false, error: err.message }, req);
    }
  }

  // 35. POST /api/memories/correct — Correct or Update Stored Memory
  if (pathname === '/api/memories/correct' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = memoryManagerInstance.correctMemory(body.query || body.id, body.newFact);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 36. GET /api/memories/export — Export Stored Memories
  if (pathname === '/api/memories/export' && req.method === 'GET') {
    const result = memoryManagerInstance.exportMemories();
    return sendJson(res, 200, result);
  }

  // 37. POST /api/command — Unified Natural Language Command Pipeline (Voice & Keyboard Ctrl+Shift+Space)
  if (pathname === '/api/command' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const rawCommand = String(body.command || body.text || '').trim();

      if (!rawCommand) {
        return sendJson(res, 400, { success: false, error: 'Command text cannot be empty.' });
      }

      // Step 1: Run through fast phonetic & typo command interpreter
      const interpreted = commandInterpreterInstance.interpret(rawCommand, personality);

      if (interpreted.matched && interpreted.toolName) {
        // Execute tool directly through permission gate
        const toolResult = await executeTool(interpreted.toolName, interpreted.args || {}, personality);
        return sendJson(res, 200, {
          success: true,
          mode: 'interpreted_tool',
          command: rawCommand,
          interpretation: interpreted.interpretation,
          toolName: interpreted.toolName,
          result: toolResult,
          summary: toolResult.summary || `Executed ${interpreted.toolName}`
        });
      }

      if (interpreted.action === 'clarification_required') {
        return sendJson(res, 200, {
          success: true,
          mode: 'clarification_required',
          command: rawCommand,
          question: interpreted.question,
          matches: interpreted.matches,
          summary: interpreted.question
        });
      }

      // Step 2: Handle non-shortcut natural queries via conversational provider
      const prompt = `User command: "${rawCommand}". If this matches a desktop, file, task, or information tool, invoke it. Otherwise answer concisely in character.`;
      const aiResponse = await new Promise((resolve, reject) => {
        let fullAnswer = '';
        aiAdapterInstance.streamResponse({
          prompt,
          personality,
          onToken: (tok) => { fullAnswer += tok; },
          onComplete: () => resolve(fullAnswer),
          onError: (err) => reject(err)
        });
      });

      return sendJson(res, 200, {
        success: true,
        mode: 'conversational_ai',
        command: rawCommand,
        response: aiResponse,
        summary: aiResponse.slice(0, 200)
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 38. GET /api/vision/status — Multimodal Vision Provider & Camera Config
  if (pathname === '/api/vision/status' && req.method === 'GET') {
    const status = visionServiceInstance.getStatus();
    return sendJson(res, 200, { success: true, status, ...status });
  }

  // 39. POST /api/vision/analyze — Direct Multimodal Image/Screen/Desk Analysis
  if (pathname === '/api/vision/analyze' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const prompt = body.prompt || 'Analyze this image in detail.';
      const imageBase64 = body.imageBase64 || '';
      const type = body.type || 'camera';

      // ULTRON separation check: ULTRON is strictly prohibited from camera & screen capture
      if (personality === 'ULTRON') {
        return sendJson(res, 403, {
          success: false,
          error: 'Security Policy: ULTRON is strictly restricted to analytical governance and cannot access live camera or screen visual streams.'
        });
      }

      // Check permission
      const permId = type === 'screen' || type === 'error' || type === 'text' ? 'screen_capture' : 'user_camera_analysis';
      if (!permissionManagerInstance.isPermissionEnabled(permId, personality)) {
        return sendJson(res, 403, {
          success: false,
          error: `Permission Denied: Capability "${permId}" is disabled in ${personality} profile.`
        });
      }

      let result;
      if (type === 'desk') {
        result = await visionServiceInstance.analyzeDeskWorkspace({ imageBase64, prompt });
      } else if (type === 'screen') {
        result = await visionServiceInstance.analyzeScreen({ imageBase64, prompt });
      } else if (type === 'error') {
        result = await visionServiceInstance.diagnoseScreenError({ imageBase64, prompt });
      } else if (type === 'text') {
        result = await visionServiceInstance.readScreenText({ imageBase64, prompt });
      } else {
        result = await visionServiceInstance.analyzeCameraImage({ imageBase64, prompt });
      }

      return sendJson(res, 200, {
        success: true,
        ...result,
        summary: result.summary || result.analysis,
        analysis: result.analysis || result.summary
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 40. POST /api/sensors/telemetry — Ambient and Hardware Sensor Telemetry Sync
  if (pathname === '/api/sensors/telemetry' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const telemetry = visionServiceInstance.getSensorTelemetry(body.clientTelemetry || body);
      return sendJson(res, 200, { success: true, telemetry });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 41. GET /api/sensors/status — Sensor Availability & Freshness Report
  if (pathname === '/api/sensors/status' && req.method === 'GET') {
    const telemetry = visionServiceInstance.getSensorTelemetry();
    const hardware = visionServiceInstance.getConnectedHardwareReport();
    return sendJson(res, 200, {
      success: true,
      telemetry,
      hardware
    });
  }

  // =========================================================================
  // 8. EXTERNAL API INTEGRATION MANAGER ENDPOINTS
  // =========================================================================

  // 42. GET /api/integrations — List All External API Integrations with Redacted Keys & Health
  if (pathname === '/api/integrations' && req.method === 'GET') {
    return sendJson(res, 200, apiIntegrationsManagerInstance.getIntegrationsSummary());
  }

  // 43. POST /api/integrations/set — Configure Credentials & Scopes for an Integration
  if (pathname === '/api/integrations/set' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = apiIntegrationsManagerInstance.setIntegration(body.providerId, body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 44. POST /api/integrations/test — Perform Real Live Connection Test
  if (pathname === '/api/integrations/test' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (body.providerId) {
        const result = await apiIntegrationsManagerInstance.testConnection(body.providerId);
        return sendJson(res, 200, result);
      } else {
        const result = await apiIntegrationsManagerInstance.testAllConnections();
        return sendJson(res, 200, result);
      }
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 45. POST /api/integrations/revoke — Securely Revoke Credentials
  if (pathname === '/api/integrations/revoke' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = apiIntegrationsManagerInstance.revokeIntegration(body.providerId);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 10. SAFE ADMINISTRATIVE & UAC ELEVATION ENDPOINTS
  // =========================================================================

  // 46. POST /api/elevation/propose — Create Elevation Proposal with Impact Assessment
  if (pathname === '/api/elevation/propose' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const proposal = elevationManagerInstance.createElevationProposal({
        operation: body.operation,
        target: body.target,
        command: body.command,
        rationale: body.rationale,
        personality
      });
      return sendJson(res, 200, { success: true, proposal });
    } catch (err) {
      return sendJson(res, 403, { success: false, error: err.message });
    }
  }

  // 47. POST /api/elevation/execute — Execute Elevated Action with UAC & Outcome Verification
  if (pathname === '/api/elevation/execute' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await elevationManagerInstance.executeElevated({
        proposalId: body.proposalId,
        userConfirmed: body.userConfirmed !== false
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 48. GET /api/elevation/proposals — List Pending Elevation Proposals
  if (pathname === '/api/elevation/proposals' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      pending: elevationManagerInstance.getPendingProposals(),
      history: elevationManagerInstance.getAuditHistory()
    });
  }

  // =========================================================================
  // 11 & 13. AUTONOMOUS SELF-REPAIR & IMPROVEMENT ENDPOINTS
  // =========================================================================

  // 49. POST /api/self-repair/diagnose — Diagnose Issue from Errors, Stack Traces or Test Outputs
  if (pathname === '/api/self-repair/diagnose' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const diagnosis = selfRepairServiceInstance.diagnoseIssue(body);
      return sendJson(res, 200, { success: true, diagnosis });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 50. POST /api/self-repair/plan — Create Repair Plan
  if (pathname === '/api/self-repair/plan' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const plan = selfRepairServiceInstance.createRepairPlan(body);
      return sendJson(res, 200, { success: true, plan });
    } catch (err) {
      return sendJson(res, 403, { success: false, error: err.message });
    }
  }

  // 51. POST /api/self-repair/stage — Stage Patch to Isolated Staging Directory
  if (pathname === '/api/self-repair/stage' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const staged = selfRepairServiceInstance.stageRepairPatch(body.planId, body.newContent);
      return sendJson(res, 200, staged);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 52. POST /api/self-repair/validate — Run Isolated Syntax, Security & Test Checks
  if (pathname === '/api/self-repair/validate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await selfRepairServiceInstance.validateCandidate(body.planId, {
        testCommand: body.testCommand
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 53. POST /api/self-repair/deploy — Backup Known-Good & Deploy Verified Patch
  if (pathname === '/api/self-repair/deploy' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await selfRepairServiceInstance.deployRepair(body.planId, {
        healthCheckUrl: body.healthCheckUrl || `http://localhost:${PORT}/api/status`
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 54. POST /api/self-repair/rollback — Restore Previous Known-Good Backup
  if (pathname === '/api/self-repair/rollback' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfRepairServiceInstance.rollbackToBackup(body.backupId);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 55. GET /api/self-repair/backups — List Available Known-Good Backups
  if (pathname === '/api/self-repair/backups' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      backups: selfRepairServiceInstance.listBackups()
    });
  }

  // 56. GET /api/self-repair/history — List Self-Repair & Deployment History
  if (pathname === '/api/self-repair/history' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      history: selfRepairServiceInstance.getRepairHistory()
    });
  }

  // =========================================================================
  // 12. SELF-HEALING SERVICE MANAGER ENDPOINTS
  // =========================================================================

  // 57. GET /api/services/health — Comprehensive Subsystem & Resource Health Matrix
  if (pathname === '/api/services/health' && req.method === 'GET') {
    return sendJson(res, 200, serviceHealingManagerInstance.getHealthReport());
  }

  // 58. POST /api/services/recover — Recover/Restart Failing Subsystem in Isolation
  if (pathname === '/api/services/recover' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await serviceHealingManagerInstance.restartService(body.serviceId, body.reason);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 59. GET /api/services/logs — Subsystem Diagnostic & Event Log
  if (pathname === '/api/services/logs' && req.method === 'GET') {
    const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
    return sendJson(res, 200, {
      success: true,
      logs: serviceHealingManagerInstance.getDiagnosticLogs(limit)
    });
  }

  // =========================================================================
  // 13. AUTONOMOUS SELF-CODING & DEVELOPMENT ENGINE ENDPOINTS
  // =========================================================================

  // 60. GET/POST /api/development/inspect — Inspect Repository Architecture & Toolchains
  if (pathname === '/api/development/inspect' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      const body = req.method === 'POST' ? await parseJsonBody(req) : {};
      const result = await selfDevelopmentEngineInstance.inspectProject(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 61. POST /api/development/search — Search Source Code Across Workspace
  if (pathname === '/api/development/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.searchSourceCode(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 62. POST /api/development/read — Safely Read Source File with Hash
  if (pathname === '/api/development/read' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.readSourceFile(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 63. POST /api/development/create — Create New Source File
  if (pathname === '/api/development/create' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.createSourceFile(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 403, { success: false, error: err.message });
    }
  }

  // 64. POST /api/development/edit — Atomically Edit Existing Source File
  if (pathname === '/api/development/edit' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.editSourceFile(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 403, { success: false, error: err.message });
    }
  }

  // 65. POST /api/development/module — Scaffold New Custom Module
  if (pathname === '/api/development/module' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.createNewModule(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 66. POST /api/development/tool/register — Register & Activate New Tool at Runtime
  if (pathname === '/api/development/tool/register' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = dynamicToolsManagerInstance.createAndRegisterTool(body.toolDefinition || body, body.code);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 67. GET /api/development/tools — List All Registered Dynamic Tools
  if (pathname === '/api/development/tools' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      tools: dynamicToolsManagerInstance.listTools()
    });
  }

  // 68. POST /api/development/tests/generate — Generate Automated Unit/Integration Tests
  if (pathname === '/api/development/tests/generate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.generateTests(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 69. POST /api/development/tests/run — Execute Test Suite
  if (pathname === '/api/development/tests/run' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await selfDevelopmentEngineInstance.runProjectTests(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 70. POST /api/development/linter — Run Syntax & Static Security Verification
  if (pathname === '/api/development/linter' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.runLinter(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 71. POST /api/development/build — Execute Project Build Script
  if (pathname === '/api/development/build' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await selfDevelopmentEngineInstance.runBuild(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 72. GET /api/development/diff — Inspect Git Status & Diffs
  if (pathname === '/api/development/diff' && req.method === 'GET') {
    const result = await selfDevelopmentEngineInstance.inspectGitDiff();
    return sendJson(res, 200, result);
  }

  // 73. POST /api/development/repair — Run Autonomous Debugging Loop
  if (pathname === '/api/development/repair' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await selfDevelopmentEngineInstance.repairCodeFailure(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 74. POST /api/development/branch — Create Development Branch or Workspace
  if (pathname === '/api/development/branch' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.createDevelopmentBranch(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 75. POST /api/development/rollback — Roll Back File to Previous Version
  if (pathname === '/api/development/rollback' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = selfDevelopmentEngineInstance.rollbackCodeChange(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 76. POST /api/development/validate — Validate Candidate Build
  if (pathname === '/api/development/validate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await selfDevelopmentEngineInstance.validateCandidateBuild(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 14. SCIENTIFIC COMPUTATION & MATHEMATICS ENDPOINTS
  // =========================================================================

  // 77. POST /api/science/calculate — Execute Verified Scientific Math
  if (pathname === '/api/science/calculate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = scientificComputationEngineInstance.executeCalculation(body);
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 78. POST /api/science/convert-units — Unit Conversion with Dimensional Verification
  if (pathname === '/api/science/convert-units' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = scientificComputationEngineInstance.convertUnits(body.value, body.fromUnit, body.toUnit, body.category);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 79. POST /api/science/monte-carlo — Run Stochastic Monte Carlo Simulation
  if (pathname === '/api/science/monte-carlo' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const model = (params) => {
        if (typeof body.modelExpr === 'string') {
          return scientificComputationEngineInstance._safeEvalMath(body.modelExpr, params);
        }
        return Object.values(params).reduce((acc, v) => acc * v, 1);
      };
      const result = scientificComputationEngineInstance.runMonteCarlo(model, body.parameterDistributions, body.trials || 5000);
      return sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 15. MECHANICAL ENGINEERING, ROBOTICS & CAD ENDPOINTS
  // =========================================================================

  // 80. POST /api/engineering/materials — Query or Compare Materials
  if (pathname === '/api/engineering/materials' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (body.materialB) {
        const result = mechanicalRoboticsEngineInstance.compareMaterials(body.materialA, body.materialB);
        return sendJson(res, 200, { success: true, ...result });
      } else {
        const result = mechanicalRoboticsEngineInstance.getMaterial(body.material || body.materialA);
        return sendJson(res, 200, { success: true, material: result });
      }
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 81. POST /api/engineering/beam-analysis — Cantilever Beam Stress & Deflection
  if (pathname === '/api/engineering/beam-analysis' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = mechanicalRoboticsEngineInstance.analyzeCantileverBeam(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 82. POST /api/engineering/kinematics — Compute Forward DH Kinematics
  if (pathname === '/api/engineering/kinematics' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = mechanicalRoboticsEngineInstance.computeForwardKinematicsDH(body.dhTable);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 83. POST /api/engineering/cad/generate — Generate Parametric OpenSCAD Code
  if (pathname === '/api/engineering/cad/generate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = mechanicalRoboticsEngineInstance.generateOpenSCADModel(body.projectType, body.parameters);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 84. GET /api/engineering/blueprint — Engineering Blueprints & BOM
  if (pathname === '/api/engineering/blueprint' && req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const projectId = parsedUrl.searchParams.get('projectId') || '5dof_robotic_arm';
      const result = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint(projectId);
      return sendJson(res, 200, { success: true, blueprint: result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 16. ELECTRONICS, FIRMWARE & EMBEDDED SYSTEMS ENDPOINTS
  // =========================================================================

  // 85. POST /api/electronics/power-budget — Battery Runtime & Peak Current
  if (pathname === '/api/electronics/power-budget' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = electronicsEmbeddedEngineInstance.calculatePowerBudget(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 86. POST /api/electronics/firmware/generate — Arduino/C++ PID Firmware
  if (pathname === '/api/electronics/firmware/generate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = electronicsEmbeddedEngineInstance.generateFirmware(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 17. AI DEVELOPMENT LABORATORY ENDPOINTS
  // =========================================================================

  // 87. POST /api/ai-lab/estimate — VRAM, Training Time & Compute Cost Estimator
  if (pathname === '/api/ai-lab/estimate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = aiDevelopmentLabInstance.estimateTrainingAndInferenceResources(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 88. POST /api/ai-lab/scaffold — Standalone Sub-Agent Project Generator
  if (pathname === '/api/ai-lab/scaffold' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = aiDevelopmentLabInstance.scaffoldAIAgentProject(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 18. ADVANCED RESEARCH & KNOWLEDGE BASE ENDPOINTS
  // =========================================================================

  // 89. GET /api/research/papers — Search ArXiv Scientific Papers
  if (pathname === '/api/research/papers' && req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const q = parsedUrl.searchParams.get('q') || 'robotics kinematics';
      const result = await advancedResearchEngineInstance.searchScientificPapers(q, 5);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 90. GET/POST /api/research/knowledge-base — Persistent Knowledge Base
  if (pathname === '/api/research/knowledge-base' && req.method === 'GET') {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const q = parsedUrl.searchParams.get('q') || '';
    const tag = parsedUrl.searchParams.get('tag') || null;
    const result = advancedResearchEngineInstance.searchKnowledgeBase(q, tag);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/research/knowledge-base' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = advancedResearchEngineInstance.saveToKnowledgeBase(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 19. FORECASTING & PROJECT ORCHESTRATION ENDPOINTS
  // =========================================================================

  // 91. POST /api/forecasting/scenarios — Multi-Scenario Forecasting
  if (pathname === '/api/forecasting/scenarios' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = forecastingScenarioEngineInstance.generateScenarioAnalysis(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 92. POST /api/projects/orchestrate — Autonomous Milestone DAG Decomposition
  if (pathname === '/api/projects/orchestrate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = autonomousProjectOrchestratorInstance.createProjectPlan(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 20. KNOWLEDGE GRAPH, MULTI-AGENT COUNCIL & RESOURCE ENDPOINTS
  // =========================================================================

  // 93. POST /api/knowledge-graph/query — Query Nodes and Neighbors
  if (pathname === '/api/knowledge-graph/query' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (body.nodeId && body.getNeighbors) {
        return sendJson(res, 200, {
          success: true,
          node: knowledgeGraphEngine.getNode(body.nodeId),
          neighbors: knowledgeGraphEngine.getNeighbors(body.nodeId, body.direction || 'both')
        });
      }
      const results = knowledgeGraphEngine.searchNodes(body.query || '', body.typeFilter || null);
      return sendJson(res, 200, { success: true, count: results.length, results });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 94. POST /api/knowledge-graph/consequence — Physical Causal Consequence Analysis
  if (pathname === '/api/knowledge-graph/consequence' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = knowledgeGraphEngine.analyzeConsequence(body.targetEntity, body.parameterChange || {}, body.options || {});
      return sendJson(res, 200, { success: true, analysis: result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 95. POST /api/knowledge-graph/decision — Record Architectural Decision
  if (pathname === '/api/knowledge-graph/decision' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = knowledgeGraphEngine.addDecision(body.projectId, body.decisionSummary, body.rationale, body.alternatives);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 96. GET /api/knowledge-graph/inspect — Inspect and Export Graph
  if (pathname === '/api/knowledge-graph/inspect' && req.method === 'GET') {
    const memory = knowledgeGraphEngine.inspectMemory();
    return sendJson(res, 200, { success: true, memory });
  }

  // 97. POST /api/agents/mission — Dispatch Multi-Agent Mission
  if (pathname === '/api/agents/mission' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const mission = await multiAgentOrchestrator.runMission(body.missionTitle || 'Engineering Mission', body.domainRequirements || {}, body.requestedRoles || []);
      return sendJson(res, 200, { success: true, mission });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 98. GET /api/agents/roles — List Specialist Agent Roles
  if (pathname === '/api/agents/roles' && req.method === 'GET') {
    const roles = multiAgentOrchestrator.getRoles();
    return sendJson(res, 200, { success: true, roles });
  }

  // 99. GET/POST /api/proactive/scan — Proactive Assistance Scanning & Notifications
  if (pathname === '/api/proactive/notifications' && req.method === 'GET') {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const filter = parsedUrl.searchParams.get('filter') || 'ALL';
    const notifs = proactiveAssistant.getNotifications(filter);
    return sendJson(res, 200, { success: true, notifications: notifs });
  }

  if (pathname === '/api/proactive/scan' && req.method === 'POST') {
    try {
      const result = await proactiveAssistant.runSystemScan();
      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 100. GET/POST /api/compute/audit — Local Hardware Audit and Task Execution Routing
  if (pathname === '/api/compute/audit' && req.method === 'GET') {
    try {
      const audit = await resourceComputeManager.getCompleteCapabilityAudit();
      return sendJson(res, 200, { success: true, audit });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/compute/route' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const routing = resourceComputeManager.routeTaskExecution(body.taskProfile || {});
      return sendJson(res, 200, { success: true, routing });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 101. STARK AI DIGITAL BRAIN & REAL-TIME TELEMETRY ENDPOINTS
  // =========================================================================

  // GET / POST /api/heart/state — JARVIS Heart, Soul & Bounded Emotional State
  if (pathname === '/api/heart/state' && (req.method === 'GET' || req.method === 'POST')) {
    const { jarvisHeartSoulEngine, JARVIS_CORE_TRAITS } = require('./server/personalityPrompts.js');
    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (body.message) {
          jarvisHeartSoulEngine.assessContext(body.message, body.history || [], { provider: body.provider || 'manual' });
        }
      } catch (_) {}
    }
    return sendJson(res, 200, {
      success: true,
      imageUrl: '/assets/jarvis-heart-core.png',
      traits: JARVIS_CORE_TRAITS,
      state: jarvisHeartSoulEngine.getStateSnapshot()
    }, req);
  }

  // GET /api/brain/console — Full real-time operations console telemetry snapshot
  if (pathname === '/api/brain/console' && req.method === 'GET') {
    try {
      const snapshot = brainArchitectureEngine.getOperationsConsoleSnapshot();
      return sendJson(res, 200, { success: true, ...snapshot });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // GET /api/brain/architecture — Subsystem overview with real status & disk stats
  if (pathname === '/api/brain/architecture' && req.method === 'GET') {
    try {
      const subsystems = brainArchitectureEngine.getSubsystemsOverview();
      return sendJson(res, 200, { success: true, total: subsystems.length, subsystems });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // GET /api/brain/subsystem — Single subsystem detail with recent telemetry
  if ((pathname.startsWith('/api/brain/subsystem/') || pathname === '/api/brain/subsystem') && req.method === 'GET') {
    try {
      let subId = urlObj.searchParams.get('id');
      if (!subId && pathname.startsWith('/api/brain/subsystem/')) {
        subId = pathname.replace('/api/brain/subsystem/', '').trim();
      }
      const subsystem = brainArchitectureEngine.getSubsystemById(subId);
      if (!subsystem) {
        return sendJson(res, 404, { success: false, error: `Subsystem '${subId}' not found` });
      }
      return sendJson(res, 200, { success: true, subsystem });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // GET /api/brain/topology — 3D Brain Point Cloud & Synaptic Filaments
  if (pathname === '/api/brain/topology' && req.method === 'GET') {
    try {
      const topology = brainArchitectureEngine.generate3DNeuralTopology();
      return sendJson(res, 200, { success: true, topology });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // GET/POST /api/brain/telemetry — Real Telemetry Stream
  if (pathname === '/api/brain/telemetry') {
    if (req.method === 'GET') {
      const limit = parseInt(urlObj.searchParams.get('limit') || '40', 10);
      const events = brainArchitectureEngine.getRecentTelemetry(limit);
      return sendJson(res, 200, { success: true, count: events.length, events });
    }
    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const event = brainArchitectureEngine.broadcastEvent(
          body.source || 'sub_security_permissions',
          body.target || 'sub_language_ai',
          body.eventType || 'USER_INTERACTION',
          body.details || {}
        );
        return sendJson(res, 200, { success: true, event });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }
  }

  // POST /api/brain/explain — Multi-Tier Pedagogical Knowledge Explainer
  if (pathname === '/api/brain/explain' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const explanation = brainArchitectureEngine.explainConcept(
        body.domain || 'Robotics',
        body.concept || 'Kinematics',
        body.level || 'intermediate'
      );
      return sendJson(res, 200, { success: true, explanation });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 102. ENGINEERING WORKSHOP & ROBOTICS BLUEPRINTS ENDPOINTS
  // =========================================================================

  // GET /api/engineering/projects — All 7 engineering projects with 13-step workflows
  if (pathname === '/api/engineering/projects' && req.method === 'GET') {
    try {
      const projects = mechanicalRoboticsEngineInstance.getAllEngineeringProjects();
      return sendJson(res, 200, { success: true, count: projects.length, projects });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // GET /api/engineering/project — Single project blueprint by ID
  if ((pathname.startsWith('/api/engineering/project/') || pathname === '/api/engineering/project') && req.method === 'GET') {
    try {
      let projId = urlObj.searchParams.get('id');
      if (!projId && pathname.startsWith('/api/engineering/project/')) {
        projId = pathname.replace('/api/engineering/project/', '').trim();
      }
      const blueprint = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint(projId);
      return sendJson(res, 200, { success: true, blueprint });
    } catch (err) {
      return sendJson(res, 404, { success: false, error: err.message });
    }
  }

  // GET /api/engineering/materials — Materials Property Database
  if (pathname === '/api/engineering/materials' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      materials: mechanicalRoboticsEngineInstance.materialsDatabase
    });
  }

  // POST /api/engineering/cad — Generate Parametric OpenSCAD Models
  if (pathname === '/api/engineering/cad' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const cad = mechanicalRoboticsEngineInstance.generateOpenSCADModel(body.projectType, body.parameters || {});
      return sendJson(res, 200, cad);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // POST /api/engineering/calculate — Verified Engineering Solvers
  if (pathname === '/api/engineering/calculate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const type = body.calculationType || 'torque';
      let result = null;

      if (type === 'torque' || type === 'motor_torque') {
        result = mechanicalRoboticsEngineInstance.calculateActuatorTorque(
          body.payloadKg || 1.0,
          body.linkLengthMeters || 0.3,
          body.linkMassKg || 0.4,
          body.angularAccelerationRadS2 || 2.0
        );
      } else if (type === 'beam' || type === 'beam_deflection') {
        result = mechanicalRoboticsEngineInstance.calculateCantileverDeflection(
          body.loadNewtons || 50,
          body.lengthMeters || 0.4,
          body.materialKey || 'aluminum_6061_t6',
          body.widthMeters || 0.03,
          body.heightMeters || 0.015
        );
      } else if (type === 'kinematics') {
        result = mechanicalRoboticsEngineInstance.computeForwardKinematics(
          body.dhParameters || [
            { theta: 0, d: 0.1, a: 0.2, alpha: 0 },
            { theta: Math.PI / 4, d: 0, a: 0.2, alpha: 0 }
          ]
        );
      } else {
        throw new Error(`Unsupported calculationType '${type}'. Supported: torque, beam, kinematics`);
      }

      // Broadcast calculation event to brain telemetry
      brainArchitectureEngine.broadcastEvent('sub_mechanical_robotics', 'sub_scientific_math', 'CALCULATION_COMPLETED', {
        type,
        summary: 'Engineering parameter calculation verified'
      });

      return sendJson(res, 200, { success: true, result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // GET /api/3d-model/catalog — 15+ Robotics & CAD Lab Archetype Catalog
  if (pathname === '/api/3d-model/catalog' && req.method === 'GET') {
    try {
      const catalog = universal3dEngine.listRobotCatalog();
      return sendJson(res, 200, { success: true, count: catalog.length, catalog });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // POST /api/3d-model/import — Import OBJ, STL, GLB, GLTF, JSON (honest error on STEP/STP)
  if (pathname === '/api/3d-model/import' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = await universal3dEngine.import3dModel(body || {});
      return sendJson(res, result.success ? 200 : (result.unsupportedFormat ? 415 : 400), result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // GET /api/3d-model/list — List saved & active 3D models inside JARVIS Vault
  if (pathname === '/api/3d-model/list' && req.method === 'GET') {
    try {
      const models = universal3dEngine.listModels();
      return sendJson(res, 200, { success: true, count: models.length, models });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // POST /api/3d-model/:modelId/save — Persist 3D design pose, theme, notes, and exports inside JARVIS
  if (pathname.startsWith('/api/3d-model/') && pathname.endsWith('/save') && req.method === 'POST') {
    try {
      const rawId = pathname.slice('/api/3d-model/'.length, -'/save'.length);
      const modelId = decodeURIComponent(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const body = await parseJsonBody(req);
      const savedModel = await universal3dEngine.saveModel(modelId, body || {});
      try {
        brainArchitectureEngine.broadcastEvent('sub_cad_geometry', 'sub_memory_continuity', '3D_MODEL_SAVED', {
          modelId: savedModel.modelId,
          name: savedModel.name,
          savedAt: savedModel.savedAt
        });
      } catch (_) {}
      return sendJson(res, 200, {
        success: true,
        verified: Boolean(savedModel?.verification?.filesVerified),
        model: savedModel
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // GET /api/3d-model/:modelId/export/:format — Download OBJ, STL, GLB, GLTF, Spec JSON, or Blender Python script
  if (pathname.startsWith('/api/3d-model/') && pathname.includes('/export/') && req.method === 'GET') {
    const parts = pathname.replace('/api/3d-model/', '').split('/export/');
    const modelId = decodeURIComponent(parts[0] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const format = (parts[1] || '').toLowerCase().trim();
    if (!['obj', 'stl', 'glb', 'gltf', 'spec', 'blender'].includes(format)) {
      return sendJson(res, 400, { success: false, error: `Unsupported 3D export format: ${format}` });
    }
    const model = universal3dEngine.getModel(modelId);
    if (!model) {
      return sendJson(res, 404, { success: false, error: `3D model '${modelId}' not found.` });
    }
    let filePath = model.files ? model.files[format] : null;
    if ((!filePath || !fs.existsSync(filePath)) && (format === 'glb' || format === 'spec')) {
      const savedRefresh = await universal3dEngine.saveModel(modelId, {});
      filePath = savedRefresh?.files?.[format];
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return sendJson(res, 404, { success: false, error: `3D model export not found for '${modelId}' (${format})` });
    }
    const ext = format === 'blender' ? 'py' : (format === 'spec' ? 'spec.json' : format);
    const filename = `${(model.name || modelId).replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
    const mime = format === 'blender'
      ? 'text/x-python'
      : (format === 'glb' ? 'model/gltf-binary' : (format === 'spec' || format === 'gltf' ? 'application/json' : 'application/octet-stream'));
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // GET /api/3d-model/:modelId — Fetch single persisted 3D model definition
  if (pathname.startsWith('/api/3d-model/') && !pathname.includes('/export/') && !pathname.endsWith('/save') && req.method === 'GET') {
    const rawId = pathname.slice('/api/3d-model/'.length);
    const modelId = decodeURIComponent(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const model = universal3dEngine.getModel(modelId);
    if (!model) {
      return sendJson(res, 404, { success: false, error: `3D model '${modelId}' not found.` });
    }
    return sendJson(res, 200, { success: true, model });
  }

  // =========================================================================
  // MULTIMODAL IMAGE GENERATION & VISUAL SYNTHESIS ROUTES
  // =========================================================================

  // POST /api/image/generate — Generate image using Imagen 3 or local procedural vector engine
  if (pathname === '/api/image/generate' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const prompt = String(body.prompt || '').trim();
      const style = String(body.style || 'realistic_photography');
      const aspectRatio = String(body.aspectRatio || '1:1');
      const negativePrompt = String(body.negativePrompt || '');
      const result = await imageGenerationEngineInstance.generateImage({
        prompt,
        style,
        aspectRatio,
        negativePrompt
      });
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/image/edit — Generate variation or prompt-driven modification of existing image
  if (pathname === '/api/image/edit' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const baseImageId = String(body.baseImageId || body.imageId || '');
      const prompt = String(body.prompt || '');
      const editInstruction = String(body.editInstruction || body.instruction || '');
      const targetStyle = body.targetStyle || null;
      const result = await imageGenerationEngineInstance.editImage({
        baseImageId,
        prompt,
        editInstruction,
        targetStyle
      });
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // GET /api/image/gallery — Retrieve persistent visual gallery ledger
  if (pathname === '/api/image/gallery' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
    const gallery = imageGenerationEngineInstance.getGallery(limit);
    return sendJson(res, 200, { success: true, count: gallery.length, images: gallery }, req);
  }

  // GET /api/image/file/:filename — Safe image asset streaming
  if (pathname.startsWith('/api/image/file/') && req.method === 'GET') {
    const rawFilename = pathname.slice('/api/image/file/'.length);
    const safeFilename = path.basename(decodeURIComponent(rawFilename || ''));
    if (!safeFilename || safeFilename.includes('..')) {
      return sendJson(res, 400, { error: 'Invalid filename' }, req);
    }
    const filePath = path.join(__dirname, 'data', 'generated_images', safeFilename);
    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: 'Image file not found' }, req);
    }
    const ext = path.extname(safeFilename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // =========================================================================
  // 102b. HOLOGRAPHIC ROBOTICS LAB (IK, STRESS/WEAKNESS, SCENE AI, GESTURE CONFIG)
  // =========================================================================

  // POST /api/robotics/ik — Solve scene DLS Inverse Kinematics + trajectory + reachability
  if (pathname === '/api/robotics/ik' && req.method === 'POST') {
    try {
      const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
      if (emergencyStopControllerInstance?.isHalted?.()) {
        return sendJson(res, 423, { success: false, blockedByEstop: true, error: 'Emergency Stop is active. Reset E-Stop before executing robotics kinematics motion.' });
      }
      const body = await parseJsonBody(req);
      let geometrySpec = body.geometrySpec || null;
      if (!geometrySpec && body.modelId) {
        const m = universal3dEngine.getModel(body.modelId);
        geometrySpec = m?.geometrySpec || null;
      }
      if (!geometrySpec) {
        const latest = universal3dEngine.listModels()[0];
        geometrySpec = latest?.geometrySpec || null;
      }
      if (!geometrySpec) {
        return sendJson(res, 404, { success: false, error: 'No active 3D robot geometrySpec found for IK solve.' });
      }
      const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js');
      const result = mechanicalRoboticsEngineInstance.solveSceneInverseKinematics(
        geometrySpec,
        body.targetScene || body.target || [2.4, 3.8, 1.2],
        { currentJointAngles: body.currentJointAngles || {} }
      );
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // POST /api/robotics/simulate — Analyze joint torques, weakest links & structural safety
  if (pathname === '/api/robotics/simulate' && req.method === 'POST') {
    try {
      const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
      if (emergencyStopControllerInstance?.isHalted?.()) {
        return sendJson(res, 423, { success: false, blockedByEstop: true, error: 'Emergency Stop is active. Robotics simulation locked until reset.' });
      }
      const body = await parseJsonBody(req);
      let geometrySpec = body.geometrySpec || null;
      if (!geometrySpec && body.modelId) {
        const m = universal3dEngine.getModel(body.modelId);
        geometrySpec = m?.geometrySpec || null;
      }
      const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js');
      const stressReport = mechanicalRoboticsEngineInstance.analyzeMechanicalStressAndWeakness(
        geometrySpec || {},
        body.jointAngles || {},
        Number(body.payloadKg ?? 1.5)
      );
      return sendJson(res, 200, stressReport);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // POST /api/robotics/scene-analyze — Scene-aware VISION engineering Q&A on selected part/joint/IK
  if (pathname === '/api/robotics/scene-analyze' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const question = String(body.question || 'Inspect the active robotic assembly.').trim();
      const sceneContext = body.sceneContext || {};
      const selectedPart = sceneContext.selectedPart || null;
      const selectedJoint = sceneContext.selectedJoint || null;
      const jointAngles = sceneContext.jointAngles || {};
      const geometrySpec = sceneContext.geometrySpec || null;

      const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js');
      const stressReport = geometrySpec
        ? mechanicalRoboticsEngineInstance.analyzeMechanicalStressAndWeakness(geometrySpec, jointAngles, Number(body.payloadKg ?? 1.5))
        : null;

      let ikReport = null;
      if (body.targetScene && geometrySpec) {
        ikReport = mechanicalRoboticsEngineInstance.solveSceneInverseKinematics(geometrySpec, body.targetScene, { currentJointAngles: jointAngles });
      }

      const facts = [];
      if (sceneContext.modelName) facts.push(`Active Model: ${sceneContext.modelName} (${sceneContext.archetype || 'custom'}, ${sceneContext.partCount || 0} parts, ${sceneContext.jointCount || 0} joints)`);
      if (selectedPart) {
        facts.push(`Pointed/Selected Part: ${selectedPart.name || selectedPart.id} [Category: ${selectedPart.category || 'structure'}, Material: ${selectedPart.material || 'Aluminum'}, Dims: ${selectedPart.dimensionsMm || 'N/A'}, Mass: ${selectedPart.massGrams || 0}g, Parent Joint: ${selectedPart.parentJoint || 'Fixed Base'}]`);
      }
      if (selectedJoint) {
        facts.push(`Selected Joint: ${selectedJoint.label || selectedJoint.id} [Axis: ${selectedJoint.axis}, Angle: ${jointAngles[selectedJoint.id] ?? selectedJoint.defaultDeg ?? 0}°, Limits: ${selectedJoint.minDeg}°..${selectedJoint.maxDeg}°, Actuator: ${selectedJoint.actuator || 'Parametric'}]`);
      }
      if (stressReport?.weakestJoint) {
        facts.push(`Weakest Actuator/Joint: ${stressReport.weakestJoint.label} — Est Load ${stressReport.weakestJoint.estimatedLoadTorqueNm} Nm vs Capacity ${stressReport.weakestJoint.estimatedActuatorCapacityNm} Nm (SF=${stressReport.weakestJoint.safetyFactor}, ${stressReport.weakestJoint.status}); Cantilever Beam Deflection ~${stressReport.beamDeflectionMm} mm (SF=${stressReport.beamSafetyFactor})`);
      }
      if (ikReport) {
        facts.push(`IK Reachability Check: ${ikReport.explanation}`);
      }

      let answer = '';
      if (/weak|fail|stress|deflect|break|torque|limit/i.test(question) && stressReport?.weakestJoint) {
        const w = stressReport.weakestJoint;
        answer = `Sir, mechanical stress evaluation identifies ${w.label} (${w.actuator}) as the tightest margin joint: dynamic torque demand at ${Number(body.payloadKg ?? 1.5)} kg payload is ${w.estimatedLoadTorqueNm} Nm against ~${w.estimatedActuatorCapacityNm} Nm rated capacity (Safety Factor ${w.safetyFactor} — ${w.status}). Structural beam deflection is ~${stressReport.beamDeflectionMm} mm (SF ${stressReport.beamSafetyFactor}).`;
      } else if (/why.*reach|can't.*reach|unreachable|singularity|workspace/i.test(question) && ikReport) {
        answer = `Sir, IK analysis reports: ${ikReport.explanation}`;
      } else if (selectedPart) {
        answer = `Inspecting ${selectedPart.name}: fabricated in ${selectedPart.material || '6061-T6 Aluminum'} (${selectedPart.dimensionsMm || 'parametric spec'}, ~${selectedPart.massGrams || 0}g), coupled to ${selectedPart.parentJoint || 'the stationary base frame'}. ${stressReport?.weakestJoint ? `Current bottleneck joint is ${stressReport.weakestJoint.label} (SF ${stressReport.weakestJoint.safetyFactor}).` : ''}`.trim();
      } else if (selectedJoint) {
        const cur = jointAngles[selectedJoint.id] ?? selectedJoint.defaultDeg ?? 0;
        answer = `${selectedJoint.label} operates on the ${selectedJoint.axis} axis driven by ${selectedJoint.actuator}, currently at ${cur}° within hardware limits [${selectedJoint.minDeg}°, ${selectedJoint.maxDeg}°].`;
      } else {
        answer = facts.join(' | ') || 'Robotics scene active and ready, sir.';
      }

      return sendJson(res, 200, {
        success: true,
        groundingLevel: 'MODEL_ESTIMATE',
        answer,
        facts,
        stressReport,
        ikReport
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // GET / POST /api/robotics/gesture-config — Persist configurable hand gesture mappings & sensitivities
  if (pathname === '/api/robotics/gesture-config') {
    const cfgPath = path.join(__dirname, 'data', 'robotics_gesture_config.json');
    const defaultCfg = {
      confidenceThreshold: 0.72,
      dwellMs: 260,
      cooldownMs: 320,
      smoothingAlpha: 0.35,
      orbitSensitivity: 1.4,
      zoomSensitivity: 1.25,
      translateSensitivity: 1.0,
      activeSubmode: 'Camera Control',
      mappings: {
        open_palm: 'pause_or_orbit',
        pinch: 'zoom_or_drag',
        fist: 'grab_or_reset_hold',
        index_point: 'raycast_select',
        two_finger: 'joint_select_mode',
        thumbs_up: 'confirm_action',
        thumbs_down: 'cancel_action',
        two_hand_spread: 'two_hand_zoom_scale'
      }
    };
    if (req.method === 'GET') {
      try {
        if (fs.existsSync(cfgPath)) {
          const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          return sendJson(res, 200, { success: true, config: { ...defaultCfg, ...parsed, mappings: { ...defaultCfg.mappings, ...(parsed.mappings || {}) } } });
        }
      } catch (_) {}
      return sendJson(res, 200, { success: true, config: defaultCfg });
    }
    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const merged = {
          ...defaultCfg,
          ...(body || {}),
          mappings: { ...defaultCfg.mappings, ...((body && body.mappings) || {}) },
          updatedAt: new Date().toISOString()
        };
        fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
        fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2), 'utf8');
        return sendJson(res, 200, { success: true, config: merged });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }
  }

  // GET /api/system/hardware-telemetry — Real Host Windows CPU/RAM/GPU/Disk Telemetry
  if (pathname === '/api/system/hardware-telemetry' && req.method === 'GET') {
    try {
      const { systemHealthEngineInstance } = require('./server/systemHealthEngine.js');
      const telemetry = await systemHealthEngineInstance.collectHostHardwareTelemetry();
      return sendJson(res, 200, telemetry);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 103. REAL CAMERA & VISUAL PERCEPTION ENDPOINTS
  // =========================================================================

  // GET /api/vision/devices — Physical camera and microphone hardware enumeration
  if (pathname === '/api/vision/devices' && req.method === 'GET') {
    return sendJson(res, 200, visionServiceInstance.getConnectedHardwareReport());
  }

  // POST /api/vision/camera-state — Real-time camera lifecycle tracking (start, stop, disconnect, error)
  if (pathname === '/api/vision/camera-state' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const result = visionServiceInstance.notifyCameraState(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // POST /api/vision/engineering-inspect — Engineering Prototype & Component Inspection
  if (pathname === '/api/vision/engineering-inspect' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = await visionServiceInstance.inspectEngineeringComponent({
        imageBase64: body.imageBase64 || body.image,
        prompt: body.prompt,
        componentType: body.componentType || 'general',
        personality
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // POST /api/vision/compare — Multi-Frame / Successive Frame Temporal Comparison
  if (pathname === '/api/vision/compare' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const personality = (body.personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      const result = await visionServiceInstance.compareFrames({
        frame1Base64: body.frame1Base64 || body.frame1,
        frame2Base64: body.frame2Base64 || body.frame2,
        prompt: body.prompt,
        personality
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // =========================================================================
  // 103b. OWNED MULTIMODAL FOUNDATION BRAIN ENDPOINTS (/api/neural/*)
  // =========================================================================

  // GET /api/neural/status — Inspect owned tokenizer, transformer & checkpoint metrics
  if (pathname === '/api/neural/status' && req.method === 'GET') {
    return sendJson(res, 200, neuralBrainServiceInstance.getStatus(), req);
  }

  // GET /api/neural/worker-health — Persistent inference worker health, queue, RSS & uptime
  if (pathname === '/api/neural/worker-health' && req.method === 'GET') {
    try {
      const health = await neuralBrainServiceInstance.getWorkerHealth();
      return sendJson(res, 200, health, req);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message }, req);
    }
  }

  // GET /api/neural/plan — Pre-training parameter, VRAM/RAM, token & cost estimates
  if (pathname === '/api/neural/plan' && req.method === 'GET') {
    try {
      const preset = urlObj.searchParams.get('preset') || 'jarvis-v0.8-research-52m';
      const vocabSize = Number(urlObj.searchParams.get('vocabSize') || 32768);
      const plan = await neuralBrainServiceInstance.planTraining({ preset, vocabSize });
      return sendJson(res, 200, plan, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // GET /api/neural/readiness — Full v0.8 Dataset Catalog, GPU Costs (USD/INR), & Pilot/Full Plan
  if (pathname === '/api/neural/readiness' && req.method === 'GET') {
    try {
      const readiness = await neuralBrainServiceInstance.getReadinessReport();
      return sendJson(res, 200, readiness, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // GET /api/neural/architecture — Multimodal architecture choices, trade-offs & hardware constraints
  if (pathname === '/api/neural/architecture' && req.method === 'GET') {
    return sendJson(res, 200, neuralBrainServiceInstance.getMultimodalArchitectureReport(), req);
  }

  // GET /api/neural/benchmark — Hardware throughput, KV-cache speedup & preset scaling bounds
  if (pathname === '/api/neural/benchmark' && req.method === 'GET') {
    try {
      const result = await neuralBrainServiceInstance.benchmarkHardware();
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // POST /api/neural/train — Train candidate owned multimodal PyTorch checkpoint
  if (pathname === '/api/neural/local-audit' && req.method === 'GET') {
    try {
      const audit = await neuralBrainServiceInstance.getLocalAudit();
      return sendJson(res, 200, audit, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/neural/local-ladder' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, { error: 'EMERGENCY_STOP_ACTIVE: Local ladder halted.', emergencyStopActive: true }, req);
    }
    try {
      const body = await parseJsonBody(req);
      const result = await neuralBrainServiceInstance.runLocalLadder(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/neural/train' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, { error: 'EMERGENCY_STOP_ACTIVE: Neural training halted.', emergencyStopActive: true }, req);
    }
    try {
      const body = await parseJsonBody(req);
      const result = await neuralBrainServiceInstance.trainCandidateCheckpoint(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/neural/evaluate — Held-out evaluation & regression gate check
  if (pathname === '/api/neural/evaluate' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const result = await neuralBrainServiceInstance.evaluateCheckpoint(body?.version);
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/neural/promote — Honesty-gated checkpoint promotion
  if (pathname === '/api/neural/promote' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, { error: 'EMERGENCY_STOP_ACTIVE: Neural promotion halted.', emergencyStopActive: true }, req);
    }
    try {
      const body = await parseJsonBody(req);
      const result = await neuralBrainServiceInstance.promoteCheckpoint(body?.version, {
        targetRole: body?.targetRole || 'experimental_local'
      });
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/neural/rollback — Roll back active experimental checkpoint to prior verified version
  if (pathname === '/api/neural/rollback' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const result = await neuralBrainServiceInstance.rollbackCheckpoint();
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/neural/infer — Direct multimodal inference on owned local transformer + vision encoder
  if (pathname === '/api/neural/infer' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (emergencyStopControllerInstance.isEngaged()) {
      return sendJson(res, 423, { error: 'EMERGENCY_STOP_ACTIVE: Neural inference halted.', emergencyStopActive: true }, req);
    }
    try {
      const body = await parseJsonBody(req);
      let imagePath = body?.imagePath || null;
      let tempPath = null;
      if (!imagePath && body?.imageBase64) {
        const tempDir = path.join(__dirname, 'data', 'vision_temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const rawB64 = String(body.imageBase64).includes(';base64,') ? String(body.imageBase64).split(';base64,')[1] : String(body.imageBase64);
        tempPath = path.join(tempDir, `neural_infer_${Date.now()}.png`);
        fs.writeFileSync(tempPath, Buffer.from(rawB64.trim(), 'base64'));
        imagePath = tempPath;
      }
      const abortController = new AbortController();
      req.on('aborted', () => abortController.abort());
      res.on('close', () => {
        if (!res.writableEnded) abortController.abort();
      });
      try {
        const result = await neuralBrainServiceInstance.inferWithOwnedBrain({
          prompt: body?.prompt || 'Design 6-DOF robotic arm',
          imagePath,
          audioPath: body?.audioPath || null,
          audioBase64: body?.audioBase64 || null,
          version: body?.version || null,
          maxNewTokens: body?.maxNewTokens || 24,
          signal: abortController.signal
        });
        return sendJson(res, 200, result, req);
      } finally {
        if (tempPath && fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // POST /api/neural/distill — Distill verified experiences + KG + inventory into multimodal datasets
  if (pathname === '/api/neural/distill' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const result = await neuralBrainServiceInstance.distillVerifiedExperiences({
        version: body?.version || null
      });
      return sendJson(res, result.success ? 200 : 400, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // 104. LIVE CAPABILITY REGISTRY & EMPIRICAL EXPERIMENT ENDPOINTS
  // =========================================================================

  // GET /api/capabilities/report — Markdown live capability registry report
  if (pathname === '/api/capabilities/report' && req.method === 'GET') {
    const reportMarkdown = capabilityRegistryInstance.generateLiveRegistryReport();
    res.writeHead(200, {
      'Content-Type': 'text/markdown; charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(reportMarkdown);
  }

  // GET /api/capabilities — Query live capability registry
  if (pathname === '/api/capabilities' && req.method === 'GET') {
    const category = urlObj.searchParams.get('category');
    const status = urlObj.searchParams.get('status');
    const groundingLevel = urlObj.searchParams.get('groundingLevel');
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (groundingLevel) filter.groundingLevel = groundingLevel;

    const list = capabilityRegistryInstance.getAllCapabilities(filter);
    return sendJson(res, 200, {
      success: true,
      count: list.length,
      capabilities: list
    });
  }

  // POST /api/capabilities/diagnose — Investigate missing dependencies & feasibility
  if (pathname === '/api/capabilities/diagnose' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const target = body.target || body.capabilityId || body.dependency || 'general';
      const diagnosis = await dependencyInvestigatorInstance.investigate(target);
      return sendJson(res, 200, {
        success: true,
        target,
        ...diagnosis,
        diagnosis
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // GET /api/experiments — Query experiment ledger and learnings summary
  if (pathname === '/api/experiments' && req.method === 'GET') {
    const category = urlObj.searchParams.get('category');
    const decision = urlObj.searchParams.get('decision');
    const filter = {};
    if (category) filter.category = category;
    if (decision) filter.decision = decision;

    const experiments = experimentLedgerInstance.getExperiments(filter);
    const learningsSummary = experimentLedgerInstance.computeLearningsSummary();
    return sendJson(res, 200, {
      success: true,
      count: experiments.length,
      learningsSummary,
      experiments
    });
  }

  // POST /api/experiments — Record an empirical experiment
  if (pathname === '/api/experiments' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const experiment = experimentLedgerInstance.recordExperiment(body);
      return sendJson(res, 200, { success: true, experiment });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // POST /api/technical/explain — Generate technical reproduction guide
  if (pathname === '/api/technical/explain' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      let result;
      if (body.type === 'simulation' || body.simulationType) {
        const simType = (body.simulationType || body.type || '').toLowerCase();
        if (simType.includes('torque') || simType.includes('actuator') || simType.includes('robot')) {
          result = technicalExplainerInstance.explainActuatorTorque(body.params || body);
        } else {
          result = technicalExplainerInstance.explainBeamDeflection(body.params || body);
        }
      } else {
        result = technicalExplainerInstance.generateReproductionGuide(body);
      }
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }


  // =========================================================================
  // 105. AUTONOMOUS TASK EXECUTION & LIFECYCLE MANAGEMENT
  // =========================================================================
  if (pathname === '/api/tasks/execute' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.instruction) {
        return sendJson(res, 400, { success: false, error: 'instruction is required' }, req);
      }
      const result = await taskOrchestratorInstance.executeAutonomousTask({
        instruction: body.instruction,
        personality: body.personality || 'JARVIS',
        maxSteps: body.maxSteps || 10,
        timeoutMs: body.timeoutMs || 60000
      });
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/tasks/history' && req.method === 'GET') {
    try {
      const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
      const history = taskOrchestratorInstance.getTaskHistory(limit);
      return sendJson(res, 200, { success: true, count: history.length, tasks: history }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/tasks/status' && req.method === 'GET') {
    try {
      const taskId = urlObj.searchParams.get('taskId');
      const status = taskOrchestratorInstance.getTaskStatus(taskId);
      return sendJson(res, 200, { success: true, status }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/tasks/cancel' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const result = taskOrchestratorInstance.cancelTask(body.taskId, body.reason || 'User cancelled');
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // 105b. STARK MISSION CONTROL & END-TO-END AUTONOMOUS ORCHESTRATION
  // =========================================================================
  if (pathname === '/api/missions/create' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const mission = missionControlEngineInstance.createMission(body);
      if (body.autoPlan !== false) {
        await missionControlEngineInstance.planMission(mission.missionId, body);
      }
      return sendJson(res, 201, { success: true, mission }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/list' && req.method === 'GET') {
    try {
      const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
      const missions = missionControlEngineInstance.listMissions(limit);
      return sendJson(res, 200, { success: true, count: missions.length, missions }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/status' && req.method === 'GET') {
    try {
      const missionId = urlObj.searchParams.get('missionId') || urlObj.searchParams.get('id');
      if (!missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId parameter is required' }, req);
      }
      const mission = missionControlEngineInstance.getMission(missionId);
      return sendJson(res, 200, { success: true, mission }, req);
    } catch (err) {
      return sendJson(res, 404, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/start' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId is required' }, req);
      }
      const result = await missionControlEngineInstance.executeMission(body.missionId, body);
      return sendJson(res, 200, { success: true, mission: result }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/pause' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId is required' }, req);
      }
      const result = missionControlEngineInstance.pauseMission(body.missionId, body.reason);
      return sendJson(res, 200, { success: true, mission: result }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/resume' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId is required' }, req);
      }
      const result = await missionControlEngineInstance.resumeMission(body.missionId, body);
      return sendJson(res, 200, { success: true, mission: result }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/cancel' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId is required' }, req);
      }
      const result = missionControlEngineInstance.cancelMission(body.missionId, body.reason);
      return sendJson(res, 200, { success: true, mission: result }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/approve' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.missionId || !body.taskId) {
        return sendJson(res, 400, { success: false, error: 'missionId and taskId are required' }, req);
      }
      const result = await missionControlEngineInstance.approveTask(body.missionId, body.taskId, body.token);
      return sendJson(res, 200, { success: true, mission: result }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // 105c. PERSONAL AI REPRESENTATIVE, DIGITAL TWIN & OFFICE EXECUTIVE MISSION CONTROL
  // =========================================================================
  if (pathname === '/api/representative/mission-control' && req.method === 'GET') {
    try {
      const { parallelOfficeExecutiveManagerInstance } = require('./server/representative/parallelOfficeExecutiveManager.js');
      const dashboard = parallelOfficeExecutiveManagerInstance.getMissionControlDashboard();
      return sendJson(res, 200, { success: true, dashboard }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/representative/action' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { executeTool } = require('./server/toolsRegistry.js');
      const { parallelOfficeExecutiveManagerInstance } = require('./server/representative/parallelOfficeExecutiveManager.js');

      if (body.controlAction === 'pause_workers') {
        return sendJson(res, 200, parallelOfficeExecutiveManagerInstance.pauseAllWorkers(body.reason), req);
      }
      if (body.controlAction === 'resume_workers') {
        return sendJson(res, 200, parallelOfficeExecutiveManagerInstance.resumeAllWorkers(), req);
      }
      if (body.toolName) {
        const out = await executeTool(body.toolName, body.args || {}, 'JARVIS');
        return sendJson(res, 200, { success: true, result: out }, req);
      }
      return sendJson(res, 400, { success: false, error: 'toolName or controlAction is required' }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/representative/meeting-room-live' && req.method === 'GET') {
    try {
      const { aiMeetingRepresentativeServiceInstance } = require('./server/representative/aiMeetingRepresentativeService.js');
      const { personalDigitalTwinServiceInstance } = require('./server/representative/personalDigitalTwinService.js');
      const twin = personalDigitalTwinServiceInstance.getStatus();
      const activeList = Array.from(aiMeetingRepresentativeServiceInstance.activeMeetings.values());
      const active = activeList[0] || aiMeetingRepresentativeServiceInstance.completedMeetings.slice(-1)[0] || {
        meetingId: 'mtg_controlled_room',
        meetingTitle: 'Controlled Microsoft Teams Test Room — Apex Robotics Review',
        aiParticipantDisplayName: `JARVIS (AI Representative for ${twin.ownerName})`,
        disclosedAsAiRepresentative: true,
        aiDisclosureStatement: `Hello everyone, I am JARVIS, joining as ${twin.ownerName}'s authorized AI Representative.`,
        transcript: [],
        actionItems: []
      };

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Controlled Teams Meeting — ${active.meetingTitle}</title>
  <style>
    body { margin: 0; background: #0b111e; color: #e2f1ff; font-family: 'Segoe UI', sans-serif; padding: 24px; }
    .disclosure-banner {
      background: linear-gradient(90deg, rgba(0,242,254,0.18), rgba(79,172,254,0.12));
      border: 1px solid #00f2fe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;
    }
    .grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; }
    .avatar-card, .transcript-card {
      background: rgba(16, 26, 46, 0.92); border: 1px solid rgba(0, 242, 254, 0.3);
      border-radius: 12px; padding: 18px;
    }
    .avatar-circle {
      width: 140px; height: 140px; border-radius: 50%; margin: 14px auto;
      border: 3px solid #00f2fe; display: flex; align-items: center; justify-content: center;
      background: radial-gradient(circle, #18345e 0%, #091326 100%);
      box-shadow: 0 0 28px rgba(0, 242, 254, 0.35);
      font-weight: 700; text-align: center; font-size: 13px; color: #7ef9ff;
    }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #00f2fe22; border: 1px solid #00f2fe; font-size: 12px; }
    .turn { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; }
  </style>
</head>
<body>
  <div id="ai-disclosure-banner" class="disclosure-banner" data-disclosed="${active.disclosedAsAiRepresentative}">
    <strong>DISCLOSED AI REPRESENTATIVE ACTIVE:</strong>
    <span id="participant-name">${active.aiParticipantDisplayName}</span> —
    <span id="disclosure-statement">${active.aiDisclosureStatement}</span>
  </div>
  <div class="grid">
    <div class="avatar-card">
      <div class="badge">Authorized Digital Twin Avatar</div>
      <div class="avatar-circle" id="digital-twin-avatar">
        ${twin.ownerName}<br/>Authorized Likeness<br/>(Lip-Sync Ready)
      </div>
      <div><strong>Avatar Status:</strong> <span id="avatar-status">${twin.avatar.status}</span></div>
      <div><strong>Voice Status:</strong> <span id="voice-status">${twin.voice.status}</span></div>
      <div><strong>Meeting ID:</strong> <span id="meeting-id">${active.meetingId}</span></div>
    </div>
    <div class="transcript-card">
      <h3 style="margin-top:0;">Live Consent-Verified Meeting Transcript & Action Items</h3>
      <div id="transcript-list">
        ${(active.transcript || []).map(t => `<div class="turn"><strong>${t.speaker}:</strong> ${t.text}</div>`).join('')}
      </div>
      <h4>Extracted Action Items (${(active.actionItems || []).length})</h4>
      <ul id="action-items-list">
        ${(active.actionItems || []).map(a => `<li>${a.description} (Owner: ${a.assignedTo}, Due: ${a.deadline})</li>`).join('')}
      </ul>
    </div>
  </div>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end(err.message);
    }
  }

  if (pathname === '/api/missions/recover' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (!body.missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId is required' }, req);
      }
      const result = await missionControlEngineInstance.recoverMission(body.missionId, body);
      return sendJson(res, 200, { success: true, mission: result }, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/missions/artifacts' && req.method === 'GET') {
    try {
      const missionId = urlObj.searchParams.get('missionId') || urlObj.searchParams.get('id');
      if (!missionId) {
        return sendJson(res, 400, { success: false, error: 'missionId parameter is required' }, req);
      }
      const mission = missionControlEngineInstance.getMission(missionId);
      return sendJson(res, 200, { success: true, missionId, artifacts: mission.artifacts }, req);
    } catch (err) {
      return sendJson(res, 404, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // PHASE 13: PRODUCTION AUTONOMOUS OBJECTIVE EXECUTION ENDPOINTS
  // =========================================================================
  if (pathname === '/api/autonomous/execute' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const objective = body.objective || body.instruction || body.goal;
      if (!objective) {
        return sendJson(res, 400, { success: false, error: 'objective is required' }, req);
      }
      const outcome = await autonomousExecutionEngineInstance.executeAutonomousObjective(objective, body);
      return sendJson(res, 200, { success: true, outcome }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/autonomous/pause' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resData = autonomousExecutionEngineInstance.pauseTask(body.taskId);
      return sendJson(res, resData.success ? 200 : 400, resData, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/autonomous/resume' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resData = autonomousExecutionEngineInstance.resumeTask(body.taskId);
      return sendJson(res, resData.success ? 200 : 400, resData, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/autonomous/cancel' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resData = autonomousExecutionEngineInstance.cancelTask(body.taskId);
      return sendJson(res, resData.success ? 200 : 400, resData, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/autonomous/status' && req.method === 'GET') {
    try {
      const taskId = urlObj.searchParams.get('taskId');
      if (!taskId) {
        return sendJson(res, 400, { success: false, error: 'taskId parameter is required' }, req);
      }
      const active = autonomousExecutionEngineInstance.activeTasks.get(taskId);
      if (active) {
        return sendJson(res, 200, {
          success: true,
          taskId: active.taskId,
          status: active.status,
          userObjective: active.userObjective,
          plannedAction: active.plannedAction,
          completedCount: active.completedNodeIds.size,
          failedCount: active.failedNodeIds.size,
          artifactsCount: active.artifacts.length,
          lastSuccessfulCheckpointId: active.lastSuccessfulCheckpointId,
          stateHistory: active.stateHistory
        }, req);
      }
      const checkpoint = autonomousExecutionEngineInstance.loadCheckpoint(taskId);
      if (checkpoint) {
        return sendJson(res, 200, { success: true, ...checkpoint }, req);
      }
      return sendJson(res, 404, { success: false, error: `Task "${taskId}" not found.` }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // 106. UNIFIED TOOL EXECUTION GATEWAY
  // =========================================================================
  if (pathname === '/api/tools/execute' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      if (emergencyStopControllerInstance.isEmergencyStopActive()) {
        return sendJson(res, 403, {
          success: false,
          error: `Security Violation: Global Emergency Stop is ACTIVE (${emergencyStopControllerInstance.stopReason})`
        }, req);
      }
      const result = await executeTool(body.toolName, body.params || {}, body.personality || 'JARVIS');
      return sendJson(res, 200, { success: true, result }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // 107. CROSS-PLATFORM ADAPTER APIS
  // =========================================================================
  if (pathname === '/api/platform/info' && req.method === 'GET') {
    try {
      const info = await platformManagerInstance.getSystemInfo();
      return sendJson(res, 200, { success: true, systemInfo: info }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/platform/matrix' && req.method === 'GET') {
    try {
      const matrix = platformManagerInstance.getCompatibilityMatrix();
      return sendJson(res, 200, { success: true, matrix }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // 108. PLUGIN & EXTENSION APIS
  // =========================================================================
  if (pathname === '/api/plugins' && req.method === 'GET') {
    try {
      const plugins = pluginManagerInstance.getPluginRegistry();
      return sendJson(res, 200, { success: true, count: plugins.length, plugins }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/plugins/execute' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      if (emergencyStopControllerInstance.isEngaged()) {
        return sendJson(res, 403, {
          success: false,
          error: 'EMERGENCY_STOP_ACTIVE: Plugin tool execution halted by global emergency stop.'
        }, req);
      }
      const body = await parseJsonBody(req);
      const result = await pluginManagerInstance.executeTool(
        body.pluginId,
        body.toolId,
        body.parameters || {},
        { personality: body.personality || 'JARVIS' }
      );
      return sendJson(res, result.success ? 200 : 400, result, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (pathname.startsWith('/api/plugins/health') && req.method === 'GET') {
    try {
      const pluginId = urlObj.searchParams.get('pluginId') || pathname.split('/').pop();
      const health = await pluginManagerInstance.runHealthCheck(pluginId);
      return sendJson(res, health.success ? 200 : 404, health, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // FRONTIER CAPABILITIES API ROUTES
  // =========================================================================
  // 1. Distributed Compute Cluster Telemetry & Task Scheduling
  if (pathname === '/api/cluster/telemetry' && req.method === 'GET') {
    return sendJson(res, 200, distributedComputeEngineInstance.getClusterTelemetry(), req);
  }
  if (pathname === '/api/cluster/schedule' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const scheduled = distributedComputeEngineInstance.scheduleTask(body);
      return sendJson(res, 200, scheduled, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 2. AI Model Discovery & Evaluation
  if (pathname === '/api/models/discovery' && req.method === 'GET') {
    return sendJson(res, 200, modelLifecycleManagerInstance.discoverLocalModels(), req);
  }
  if (pathname === '/api/models/evaluate' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const evalRes = modelLifecycleManagerInstance.evaluateModel(body.modelId, body.benchmarkSet);
      return sendJson(res, 200, evalRes, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 3. Digital Twins & Telemetry Sync
  if (pathname.startsWith('/api/digital-twin/') && req.method === 'GET') {
    const twinId = pathname.replace('/api/digital-twin/', '');
    const status = digitalTwinEngineInstance.getTwinStatus(twinId);
    return sendJson(res, status ? 200 : 404, status || { error: 'Twin not found' }, req);
  }
  if (pathname === '/api/digital-twin/sync' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const syncResult = digitalTwinEngineInstance.syncStep(body.twinId, body.inputCommands, body.measuredTelemetry, body.dtSeconds);
      return sendJson(res, 200, syncResult, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 4. Engineering Design Exploration & Pareto Optimization
  if (pathname === '/api/design/pareto' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const pareto = designExplorationEngineInstance.exploreParetoFront(body);
      return sendJson(res, 200, pareto, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 5. Closed-Loop Scientific Experimentation
  if (pathname === '/api/experiments/closed-loop' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const exp = closedLoopExperimentationEngineInstance.designExperiment(body);
      return sendJson(res, 200, exp, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 6. Formal Verification Invariants
  if (pathname === '/api/verification/invariants' && req.method === 'GET') {
    return sendJson(res, 200, verificationAdversarialEngineInstance.verifySystemInvariants(), req);
  }

  // 7. Spatial Computing Hardware & Overlays
  if (pathname === '/api/spatial/hardware' && req.method === 'GET') {
    return sendJson(res, 200, spatialComputingEngineInstance.detectSpatialHardware(), req);
  }

  // 8. Reliability Circuit Breakers Health
  if (pathname === '/api/reliability/health' && req.method === 'GET') {
    return sendJson(res, 200, reliabilityEngineInstance.getReliabilityHealth(), req);
  }

  // 9. Cross-Device Continuity Status
  if (pathname === '/api/continuity/devices' && req.method === 'GET') {
    return sendJson(res, 200, crossDeviceContinuityManagerInstance.getContinuityStatus(), req);
  }

  // 10. Long-Term Maintenance Overview
  if (pathname === '/api/maintenance/overview' && req.method === 'GET') {
    return sendJson(res, 200, {
      env: maintenanceCompatibilityEngineInstance.validateEnvironment(),
      deps: maintenanceCompatibilityEngineInstance.inspectDependencies(),
      deprecations: maintenanceCompatibilityEngineInstance.checkApiDeprecations(),
      migrations: maintenanceCompatibilityEngineInstance.getMigrationHistory()
    }, req);
  }

  // 11. Pre-Task Capability Feasibility Check
  if (pathname === '/api/capabilities/feasibility' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const feasibility = capabilityRegistryInstance.evaluateTaskFeasibility(body);
      return sendJson(res, 200, feasibility, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // STARK BEYOND MASTER INTELLIGENCE API ROUTES
  // =========================================================================

  // 12. Experiment Factory: Campaigns
  if (pathname === '/api/intelligence/experiment/campaign' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const camp = experimentFactoryInstance.createCampaign(body);
      if (Array.isArray(body.candidates)) {
        body.candidates.forEach(c => experimentFactoryInstance.registerCandidate(camp.id, c));
      } else {
        experimentFactoryInstance.registerCandidate(camp.id, {
          name: 'Optimized Candidate Baseline Alpha',
          parameters: { tuningDelta: 0.15 }
        });
      }
      const summary = await experimentFactoryInstance.runCampaign(camp.id);
      return sendJson(res, 200, summary, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/intelligence/experiment/campaigns' && req.method === 'GET') {
    return sendJson(res, 200, experimentFactoryInstance.listCampaigns(), req);
  }

  // 13. Forecasting Engine: Predictions & Calibration
  if (pathname === '/api/intelligence/forecast/predict' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const pred = forecastingEngineInstance.generatePrediction(body);
      return sendJson(res, 200, pred, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/intelligence/forecast/eval' && req.method === 'GET') {
    return sendJson(res, 200, forecastingEngineInstance.evaluateForecastAccuracy(), req);
  }

  // 14. Predictive Failure Risk Telemetry
  if (pathname === '/api/intelligence/telemetry/risks' && req.method === 'GET') {
    return sendJson(res, 200, forecastingEngineInstance.detectPredictiveFailures(), req);
  }

  // 15. Goal Guardian: Long-Term Objective Tracking
  if (pathname === '/api/intelligence/goals' && req.method === 'GET') {
    return sendJson(res, 200, goalGuardianInstance.listGoals(), req);
  }

  if (pathname === '/api/intelligence/goals' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const goal = goalGuardianInstance.createGoal(body);
      return sendJson(res, 200, goal, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 16. Research Experiment Scheduler: Jobs
  if (pathname === '/api/intelligence/scheduler/jobs' && req.method === 'GET') {
    return sendJson(res, 200, experimentSchedulerInstance.listJobs(), req);
  }

  if (pathname === '/api/intelligence/scheduler/jobs' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const job = experimentSchedulerInstance.scheduleJob(body);
      return sendJson(res, 200, job, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 17. Future Capabilities Lab: Backlog & Prototypes
  if (pathname === '/api/intelligence/future/backlog' && req.method === 'GET') {
    return sendJson(res, 200, futureCapabilitiesLabInstance.getResearchBacklog(), req);
  }

  if (pathname === '/api/intelligence/future/prototype' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const capId = body.capabilityId || 'CAP_20';
      let outcome;
      if (capId === 'CAP_20') outcome = futureCapabilitiesLabInstance.evaluatePromptOptimization(body.candidates, body.tasks);
      else if (capId === 'CAP_21') outcome = futureCapabilitiesLabInstance.simulateLocalComputerAction(body.actionSpec);
      else if (capId === 'CAP_22') outcome = futureCapabilitiesLabInstance.synthesizeRoboticJointDesign(body.params);
      else if (capId === 'CAP_23') outcome = futureCapabilitiesLabInstance.evaluateRoboticSafetyBounds(body.jointAnglesDeg);
      else if (capId === 'CAP_24') outcome = futureCapabilitiesLabInstance.computeScientificParetoFront(body.candidates);
      else if (capId === 'CAP_25') outcome = futureCapabilitiesLabInstance.generateEngineeringDiffReview(body.originalContent, body.proposedContent, body.context);
      else outcome = futureCapabilitiesLabInstance.getResearchBacklog();

      return sendJson(res, 200, outcome, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // =========================================================================
  // STARK BEYOND 100 FUTURE TECHNOLOGY RESEARCH & ENGINEERING API
  // =========================================================================

  // 18. Future Capabilities Registry & Maturity
  if (pathname === '/api/beyond/capabilities' && req.method === 'GET') {
    return sendJson(res, 200, futureCapabilityRegistryInstance.listCapabilities(), req);
  }

  if (pathname === '/api/beyond/capability' && req.method === 'GET') {
    const capId = urlObj.searchParams.get('id');
    const cap = futureCapabilityRegistryInstance.getCapability(capId);
    if (!cap) return sendJson(res, 404, { error: `Capability ${capId} not found` }, req);
    return sendJson(res, 200, cap, req);
  }

  if (pathname === '/api/beyond/capability/maturity' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const updated = futureCapabilityRegistryInstance.updateMaturityLevel(body.id, body.newLevel, body.evidence);
      return sendJson(res, 200, updated, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 19. Scientific Research Pipeline Execution
  if (pathname === '/api/beyond/research/pipeline' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const run = futureCapabilityRegistryInstance.executeScientificPipeline(body);
      return sendJson(res, 200, run, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 20. World-Model State & Predictive Action Impact
  if (pathname === '/api/beyond/world-model/state' && req.method === 'GET') {
    return sendJson(res, 200, worldModelEngineInstance.captureWorldModelState(), req);
  }

  if (pathname === '/api/beyond/world-model/predict' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const pred = worldModelEngineInstance.predictActionImpact(body.actionSpec || {});
      const observed = worldModelEngineInstance.observeAndLearn(pred, () => {
        return { simulatedResult: 'Observation verified by world-model' };
      });
      return sendJson(res, 200, observed, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 21. Simulated Environments
  if (pathname === '/api/beyond/simulate/sandbox' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const simType = body.type || 'FILE_OP';
      let simResult;
      if (simType === 'FILE_OP') simResult = worldModelEngineInstance.simulateFileOperation(body.fileName || 'test.txt', body.content || 'Sample');
      else if (simType === 'TASK_FAILURE') simResult = worldModelEngineInstance.simulateTaskFailureAndRecovery(body.failureMode);
      else if (simType === 'RESOURCE_EXHAUSTION') simResult = worldModelEngineInstance.simulateResourceExhaustion(body.simulatedHeapMb);
      else if (simType === 'ROBOT_MOTION') simResult = worldModelEngineInstance.simulateRobotMotion(body.trajectoryPoints);
      else simResult = { simulated: true, type: simType };

      return sendJson(res, 200, simResult, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 22. Advanced Engineering Lab: Exoskeleton, Propulsion, Energy
  if (pathname === '/api/beyond/engineering/exoskeleton' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resKnee = advancedEngineeringLabInstance.evaluateExoskeletonKneeJoint(body);
      return sendJson(res, 200, resKnee, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/beyond/engineering/propulsion' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resProp = body.propulsionType === 'ION_THRUSTER'
        ? advancedEngineeringLabInstance.evaluateIonThrusterPhysics(body)
        : advancedEngineeringLabInstance.evaluateEvtolHoverDynamics(body);
      return sendJson(res, 200, resProp, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/beyond/engineering/energy' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resEnergy = body.auditType === 'FUSION_LAWSON_CRITERION'
        ? advancedEngineeringLabInstance.evaluateLawsonFusionCriterion(body.densityM3, body.temperatureKev, body.confinementTimeS)
        : advancedEngineeringLabInstance.auditEnergySystemBudget(body);
      return sendJson(res, 200, resEnergy, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 23. Human Interface Lab: BCI Simulation & Multimodal
  if (pathname === '/api/beyond/bci/simulate' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    try {
      const body = await parseJsonBody(req);
      const resBci = humanInterfaceLabInstance.simulateMotorImageryDecoding(body.channels || 8);
      return sendJson(res, 200, resBci, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  // 24. Research Dashboard Overview (Section 22)
  if (pathname === '/api/beyond/dashboard/overview' && req.method === 'GET') {
    const caps = futureCapabilityRegistryInstance.listCapabilities();
    const campaigns = experimentFactoryInstance.listCampaigns();
    const jobs = experimentSchedulerInstance.listJobs();
    const worldModel = worldModelEngineInstance.captureWorldModelState();
    const forecastAccuracy = forecastingEngineInstance.evaluateForecastAccuracy();
    const goals = goalGuardianInstance.listGoals();

    return sendJson(res, 200, {
      timestamp: new Date().toISOString(),
      capabilitiesCount: caps.length,
      capabilities: caps.map(c => ({
        id: c.id,
        userFacingGoal: c.userFacingGoal,
        maturityLevel: c.maturityLevel,
        nextRecommendedExperiment: c.nextRecommendedExperiment
      })),
      experimentCampaigns: {
        totalCampaigns: campaigns.length,
        recentCampaigns: campaigns.slice(-3)
      },
      scheduledJobs: {
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.status === 'RUNNING' || j.status === 'QUEUED')
      },
      worldModelTelemetry: {
        heapUsedMb: worldModel.telemetry.heapUsedMb,
        uptimeSeconds: worldModel.telemetry.uptimeSeconds,
        modelWeights: worldModel.modelWeights
      },
      forecastAccuracy,
      goalsActive: goals.filter(g => g.status === 'ACTIVE').length,
      emergencyStopArmed: !emergencyStopControllerInstance.isEngaged()
    }, req);
  }

  // =========================================================================
  // PHASE 14 PERSONAL INTELLIGENCE & PROACTIVE ASSISTANCE ENDPOINTS
  // =========================================================================

  if (pathname === '/api/personal/context' && req.method === 'GET') {
    const { personalContextEngineInstance } = require('./server/memory/personalContextEngine.js');
    const prefs = personalContextEngineInstance.getPreferences();
    const projects = personalContextEngineInstance.getAllProjects();
    const goals = personalContextEngineInstance.getGoals();
    return sendJson(res, 200, {
      success: true,
      timestamp: new Date().toISOString(),
      preferences: prefs,
      projects,
      goals
    }, req);
  }

  if (pathname === '/api/personal/preference' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { personalContextEngineInstance } = require('./server/memory/personalContextEngine.js');
        const saved = personalContextEngineInstance.setPreference(data.category, data.key, data.value, 'USER_CONFIRMED');
        return sendJson(res, 200, { success: true, saved }, req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message }, req);
      }
    });
    return;
  }

  if (pathname === '/api/personal/projects' && req.method === 'GET') {
    const { personalContextEngineInstance } = require('./server/memory/personalContextEngine.js');
    const { projectIntelligenceEngineInstance } = require('./server/project/projectIntelligenceEngine.js');
    const projects = personalContextEngineInstance.getAllProjects().map(p => {
      const briefing = projectIntelligenceEngineInstance.getProjectBriefing(p.id);
      return { ...p, briefing };
    });
    return sendJson(res, 200, { success: true, count: projects.length, projects }, req);
  }

  if (pathname === '/api/personal/project' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { personalContextEngineInstance } = require('./server/memory/personalContextEngine.js');
        const proj = personalContextEngineInstance.createOrUpdateProject(data);
        return sendJson(res, 200, { success: true, project: proj }, req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message }, req);
      }
    });
    return;
  }

  if (pathname === '/api/personal/knowledge-graph' && req.method === 'GET') {
    const { personalKnowledgeGraphInstance } = require('./server/memory/personalKnowledgeGraph.js');
    const metrics = personalKnowledgeGraphInstance.getMetrics();
    const entityId = urlObj.searchParams.get('entityId') || 'usr_harsh';
    const depth = Number(urlObj.searchParams.get('depth') || 2);
    const subgraph = personalKnowledgeGraphInstance.getSubgraph(entityId, depth);
    return sendJson(res, 200, { success: true, metrics, subgraph }, req);
  }

  if (pathname === '/api/personal/proactive' && req.method === 'GET') {
    const { proactiveAssistanceEngineInstance } = require('./server/proactive/proactiveAssistanceEngine.js');
    const level = proactiveAssistanceEngineInstance.getAssistanceLevel();
    const pending = proactiveAssistanceEngineInstance.getPendingNotifications();
    return sendJson(res, 200, { success: true, level, pendingCount: pending.length, notifications: pending }, req);
  }

  if (pathname === '/api/personal/proactive/level' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { proactiveAssistanceEngineInstance } = require('./server/proactive/proactiveAssistanceEngine.js');
        const result = proactiveAssistanceEngineInstance.setAssistanceLevel(data.level);
        return sendJson(res, 200, { success: true, result }, req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message }, req);
      }
    });
    return;
  }

  if (pathname === '/api/personal/proactive/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { proactiveAssistanceEngineInstance } = require('./server/proactive/proactiveAssistanceEngine.js');
        const result = proactiveAssistanceEngineInstance.actOnNotification(data.notificationId, data.action, data.options || {});
        return sendJson(res, 200, { success: true, result }, req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message }, req);
      }
    });
    return;
  }

  if (pathname === '/api/personal/avoid-topics' && req.method === 'GET') {
    const { memoryManagementEngineInstance } = require('./server/memory/memoryManagementEngine.js');
    return sendJson(res, 200, { success: true, avoidTopics: memoryManagementEngineInstance.getAvoidTopics() }, req);
  }

  if (pathname === '/api/personal/avoid-topics' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { memoryManagementEngineInstance } = require('./server/memory/memoryManagementEngine.js');
        const result = memoryManagementEngineInstance.registerAvoidTopic(data.topic);
        return sendJson(res, 200, { success: true, result }, req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message }, req);
      }
    });
    return;
  }

  if (pathname === '/api/personal/memory/verify-delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const { memoryManagementEngineInstance } = require('./server/memory/memoryManagementEngine.js');
        const result = memoryManagementEngineInstance.deleteMemory(data.memoryId);
        return sendJson(res, 200, { success: true, result }, req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message }, req);
      }
    });
    return;
  }

  // =========================================================================
  // LIVE DOCUMENT STUDIO & VOICE-CONTROLLED WORD COLLABORATION ENDPOINTS
  // =========================================================================

  if (pathname === '/api/document-studio/status' && req.method === 'GET') {
    const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
    return sendJson(res, 200, {
      success: true,
      timestamp: new Date().toISOString(),
      ...liveDocumentStudioInstance.getStudioStatus()
    }, req);
  }

  if (pathname === '/api/document-studio/create' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
      const result = await liveDocumentStudioInstance.createDocumentProgressively(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/document-studio/revise' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
      const result = await liveDocumentStudioInstance.applyVoiceRevision(body.instruction || body.query || '', body);
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/document-studio/save' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
      const result = await liveDocumentStudioInstance.saveDocumentSession(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/document-studio/whatsapp' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
      if (body.confirm === true) {
        const result = await liveDocumentStudioInstance.confirmPendingWhatsAppDelivery();
        return sendJson(res, 200, result, req);
      }
      const result = await liveDocumentStudioInstance.deliverDocumentViaWhatsApp(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/document-studio/control' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
      const action = String(body.action || 'STATUS').toUpperCase();
      if (action === 'UNDO') {
        const result = await liveDocumentStudioInstance.undoLastRevision();
        return sendJson(res, 200, result, req);
      }
      if (action === 'RECOVER') {
        const result = await liveDocumentStudioInstance.recoverInterruptedSession();
        return sendJson(res, 200, result, req);
      }
      if (action === 'OPEN_IN_WORD') {
        const result = await liveDocumentStudioInstance.openInMicrosoftWord(body);
        return sendJson(res, 200, result, req);
      }
      const result = liveDocumentStudioInstance.controlStudioWindow(action);
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }

  if (pathname === '/api/document-studio/open-word' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');
      const result = await liveDocumentStudioInstance.openInMicrosoftWord(body || {});
      return sendJson(res, 200, result, req);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message }, req);
    }
  }



  // =========================================================================
  // STATIC ASSET SERVING — STRICT CANONICAL ALLOWLIST
  // =========================================================================
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=UTF-8', 'X-Content-Type-Options': 'nosniff' });
    res.end('405 Method Not Allowed');
    return;
  }

  // 1. Validate raw URI decoding and null byte injection
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8', 'X-Content-Type-Options': 'nosniff' });
    res.end('400 Bad Request: Malformed URI');
    return;
  }

  if (decodedPath.includes('\0') || decodedPath.includes('%00')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8', 'X-Content-Type-Options': 'nosniff' });
    res.end('403 Forbidden: Null byte injection detected');
    return;
  }

  // Map root
  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = '/index.html';
  }

  // 2. Canonicalize path
  const projectRoot = path.resolve(__dirname);
  const resolvedTarget = path.resolve(projectRoot, '.' + (decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath));

  // 3. Strict allowlist verification
  const indexHtmlPath = path.resolve(projectRoot, 'index.html');
  const faviconIcoPath = path.resolve(projectRoot, 'favicon.ico');
  const cssDir = path.resolve(projectRoot, 'css');
  const jsDir = path.resolve(projectRoot, 'js');
  const assetsDir = path.resolve(projectRoot, 'assets');

  const resolvedTargetLower = resolvedTarget.toLowerCase();
  const isExactIndex = (resolvedTargetLower === indexHtmlPath.toLowerCase());
  const isExactFavicon = (resolvedTargetLower === faviconIcoPath.toLowerCase());
  const isAllowedCss = (resolvedTargetLower.startsWith(cssDir.toLowerCase() + path.sep) && resolvedTargetLower.endsWith('.css'));
  const isAllowedJs = (resolvedTargetLower.startsWith(jsDir.toLowerCase() + path.sep) && (resolvedTargetLower.endsWith('.js') || resolvedTargetLower.endsWith('.mjs')));
  const isAllowedAsset = (resolvedTargetLower.startsWith(assetsDir.toLowerCase() + path.sep) && /\.(png|jpe?g|webp|svg|ico)$/.test(resolvedTargetLower));
  const jsLibsDir = path.resolve(jsDir, 'libs');
  const isAllowedJsLibAsset = (resolvedTargetLower.startsWith(jsLibsDir.toLowerCase() + path.sep) && (resolvedTargetLower.endsWith('.wasm') || resolvedTargetLower.endsWith('.task')));

  const isExplicitlyAllowed = isExactIndex || isExactFavicon || isAllowedCss || isAllowedJs || isAllowedAsset || isAllowedJsLibAsset;

  if (!isExplicitlyAllowed) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end('403 Forbidden: Access to requested asset is restricted.');
    return;
  }

  // 4. File existence and stat
  fs.stat(resolvedTarget, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(resolvedTarget).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const origin = getCorsOrigin(req);

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': origin
    };

    // If serving index.html, attach HttpOnly SameSite=Strict session cookie
    if (isExactIndex) {
      headers['Set-Cookie'] = serverAuthManagerInstance.createSessionCookieHeader();
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(resolvedTarget);
    stream.pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`ULTRON × JARVIS Dual AI Companion server active at http://${HOST}:${PORT}`);
    liveWebResearchService.initializeOnStartup().catch((err) => {
      console.warn('[WEB_INTEL] Startup health check warning:', err.message);
    });
  });
} else {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[SERVER] Port ${PORT} already bound by active process; leveraging running instance.`);
    } else {
      throw err;
    }
  });
  if (!server.listening) {
    try {
      server.listen(PORT, HOST, () => {
        console.log(`ULTRON × JARVIS Dual AI Companion server active at http://${HOST}:${PORT}`);
        liveWebResearchService.initializeOnStartup().catch((err) => {
          console.warn('[WEB_INTEL] Startup health check warning:', err.message);
        });
      });
    } catch (_) {}
  }
}

module.exports = { server };
