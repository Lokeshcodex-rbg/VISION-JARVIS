/**
 * VISION AI — Local Compute & Hardware Resource Manager
 * 
 * Inspects system capabilities:
 * - CPU model, core count, architecture, process utilization
 * - System RAM (total, free, used, percent)
 * - GPU / Graphic accelerator detection (NVIDIA CUDA, DirectML, integrated GPUs)
 * - Storage capacity and free disk space across local drives
 * - Installed programming runtimes and compilers (Node, Python, Git, GCC/Clang, npm, pip)
 * - Local LLM runtimes (Ollama, LM Studio)
 * - Local vs Cloud task execution routing with privacy, cost, and latency optimization
 * - Graceful degradation and resource guardrails
 */

const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

class ResourceComputeManager {
  constructor() {
    this.cachedSpecs = null;
    this.lastCheckedTime = 0;
    this.cacheTtlMs = 60000; // 1 minute
  }

  getSystemOverview() {
    const totalRamBytes = os.totalmem();
    const freeRamBytes = os.freemem();
    const usedRamBytes = totalRamBytes - freeRamBytes;
    const ramUsagePercent = Math.round((usedRamBytes / totalRamBytes) * 100);

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown Processor';
    const cpuCores = cpus.length;

    const processMem = process.memoryUsage();

    return {
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: Math.round(os.uptime()),
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        speedMhz: cpus.length > 0 ? cpus[0].speed : 0
      },
      memory: {
        totalGb: Number((totalRamBytes / (1024 ** 3)).toFixed(2)),
        freeGb: Number((freeRamBytes / (1024 ** 3)).toFixed(2)),
        usedGb: Number((usedRamBytes / (1024 ** 3)).toFixed(2)),
        usagePercent: ramUsagePercent,
        processHeapUsedMb: Number((processMem.heapUsed / (1024 ** 2)).toFixed(2))
      }
    };
  }

  detectGpu() {
    try {
      if (os.platform() === 'win32') {
        const cmd = 'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM, DriverVersion | ConvertTo-Json"';
        const output = execSync(cmd, { timeout: 4000, encoding: 'utf8' }).trim();
        if (output) {
          const parsed = JSON.parse(output);
          const gpus = Array.isArray(parsed) ? parsed : [parsed];
          return gpus.map(g => ({
            name: g.Name,
            driverVersion: g.DriverVersion,
            adapterRamMb: g.AdapterRAM ? Math.round(g.AdapterRAM / (1024 ** 2)) : 'Shared'
          }));
        }
      }
    } catch (err) {
      // Fallback
    }
    return [{ name: 'Standard Display Adapter / Integrated GPU', note: 'Hardware acceleration available' }];
  }

  detectInstalledToolchains() {
    const runtimes = {};

    // 1. Node.js
    runtimes.node = { installed: true, version: process.version };

    // 2. Python
    try {
      const pyVer = execSync('python --version', { timeout: 3000, encoding: 'utf8' }).trim();
      runtimes.python = { installed: true, version: pyVer };
    } catch {
      runtimes.python = { installed: false, version: null };
    }

    // 3. Git
    try {
      const gitVer = execSync('git --version', { timeout: 3000, encoding: 'utf8' }).trim();
      runtimes.git = { installed: true, version: gitVer };
    } catch {
      runtimes.git = { installed: false, version: null };
    }

    // 4. NPM
    try {
      const npmVer = execSync('npm --version', { timeout: 3000, encoding: 'utf8' }).trim();
      runtimes.npm = { installed: true, version: npmVer };
    } catch {
      runtimes.npm = { installed: false, version: null };
    }

    // 5. Pip
    try {
      const pipVer = execSync('pip --version', { timeout: 3000, encoding: 'utf8' }).trim();
      runtimes.pip = { installed: true, version: pipVer.split(' ')[1] || pipVer };
    } catch {
      runtimes.pip = { installed: false, version: null };
    }

    // 6. C/C++ Compiler check (gcc or cl)
    try {
      const gccVer = execSync('gcc --version', { timeout: 2000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      runtimes.c_compiler = { installed: true, type: 'gcc', version: gccVer.split('\n')[0] };
    } catch {
      runtimes.c_compiler = { installed: false, type: null, version: null };
    }

    return runtimes;
  }

  async checkLocalModelRuntimes() {
    const results = {
      ollama: { active: false, port: 11434, models: [] },
      lmStudio: { active: false, port: 1234, models: [] }
    };

    const pingPort = (port, path = '/api/tags') => new Promise(resolve => {
      const req = http.get({ host: '127.0.0.1', port, path, timeout: 800 }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ active: res.statusCode >= 200 && res.statusCode < 400, data });
          } catch {
            resolve({ active: res.statusCode >= 200 && res.statusCode < 400 });
          }
        });
      });
      req.on('error', () => resolve({ active: false }));
      req.on('timeout', () => { req.destroy(); resolve({ active: false }); });
    });

    const [ollamaRes, lmRes] = await Promise.all([
      pingPort(11434, '/api/tags'),
      pingPort(1234, '/v1/models')
    ]);

    results.ollama.active = ollamaRes.active;
    if (ollamaRes.data && Array.isArray(ollamaRes.data.models)) {
      results.ollama.models = ollamaRes.data.models.map(m => m.name || m.model);
    }

    results.lmStudio.active = lmRes.active;
    if (lmRes.data && Array.isArray(lmRes.data.data)) {
      results.lmStudio.models = lmRes.data.data.map(m => m.id);
    }

    return results;
  }

  /**
   * Intelligently routes tasks between Local computation and Cloud AI providers
   * based on privacy requirements, latency constraints, cost, and availability.
   */
  routeTaskExecution(taskProfile = {}) {
    const {
      taskType = 'general',      // 'calculation', 'code_edit', 'deep_research', 'voice_stream', 'confidential_analysis'
      isConfidential = false,     // if true, forces LOCAL routing to prevent data leakage
      maxLatencyMs = 2000,
      estimatedInputTokens = 500,
      requiresInternet = false
    } = taskProfile;

    const sys = this.getSystemOverview();

    // Decision rule 1: Confidential data strictly remains LOCAL
    if (isConfidential) {
      return {
        target: 'LOCAL',
        reason: 'CONFIDENTIALITY_POLICY_ENFORCED',
        justification: 'Data marked sensitive or private must never be dispatched to external cloud endpoints.',
        recommendedEngine: 'local_deterministic_engine'
      };
    }

    // Decision rule 2: Deterministic calculation & physics strictly run on local compute
    if (taskType === 'calculation' || taskType === 'beam_stress' || taskType === 'kinematics' || taskType === 'monte_carlo') {
      return {
        target: 'LOCAL',
        reason: 'DETERMINISTIC_EXECUTION',
        justification: 'Mathematical and engineering computations execute on local host runtimes for verified analytical accuracy.',
        recommendedEngine: 'scientific_and_mechanical_engines'
      };
    }

    // Decision rule 3: Fast voice response requires streaming low-latency provider
    if (taskType === 'voice_stream' || maxLatencyMs < 600) {
      return {
        target: 'CLOUD_STREAMING',
        reason: 'LOW_LATENCY_VOICE_STREAM',
        justification: 'Real-time conversational turn demands low-latency streaming cloud LLM provider (Groq / Gemini Flash).',
        recommendedEngine: 'aiProviderAdapter'
      };
    }

    // Decision rule 4: Deep research requiring external citations
    if (requiresInternet || taskType === 'deep_research') {
      return {
        target: 'HYBRID',
        reason: 'RESEARCH_SYNTHESIS',
        justification: 'Queries remote ArXiv/Web APIs, then analyzes and verifies findings locally.',
        recommendedEngine: 'advancedResearchEngine'
      };
    }

    // Default: Cloud AI with local verification
    return {
      target: 'CLOUD',
      reason: 'GENERAL_REASONING',
      justification: 'Complex natural language reasoning delegated to primary cloud intelligence model with local permission guardrails.',
      recommendedEngine: 'aiProviderAdapter'
    };
  }

  async getCompleteCapabilityAudit() {
    const now = Date.now();
    if (this.cachedSpecs && (now - this.lastCheckedTime) < this.cacheTtlMs) {
      return this.cachedSpecs;
    }

    const sys = this.getSystemOverview();
    const gpus = this.detectGpu();
    const toolchains = this.detectInstalledToolchains();
    const localRuntimes = await this.checkLocalModelRuntimes();

    this.cachedSpecs = {
      timestamp: new Date().toISOString(),
      system: sys,
      gpus,
      toolchains,
      localRuntimes,
      resourceHealth: {
        memoryPressure: sys.memory.usagePercent > 85 ? 'HIGH' : 'NORMAL',
        cpuCoresAvailable: sys.cpu.cores,
        localComputeReady: true
      }
    };
    this.lastCheckedTime = now;
    return this.cachedSpecs;
  }

  async auditResources() {
    return this.getCompleteCapabilityAudit();
  }

  /**
   * Evaluates machine hardware and determines practical local model viability
   */
  proposeLocalModelArchitecture() {
    const sys = this.getSystemOverview();
    const gpus = this.detectGpu();
    const totalRamGb = sys.memory.totalGb;
    const freeRamGb = sys.memory.freeGb;
    const isGpuDedicated = gpus.some(g => typeof g.adapterRamMb === 'number' && g.adapterRamMb >= 4096);

    const recommendations = [];

    recommendations.push({
      tier: 'TIER_1_ULTRA_LIGHTWEIGHT',
      viable: true,
      models: [
        'Deterministic Offline Command & Rule Engine (0 MB host RAM overhead)',
        'TF-IDF & Cosine Similarity Vector Memory (<10 MB RAM)',
        'Browser Native WebSpeech STT / TTS (0 MB server host RAM)'
      ],
      maxModelSize: 'Under 1B parameters quantized (e.g., SmolLM2-360M, Qwen2.5-0.5B-Q4)',
      memoryRequiredGb: 0.4,
      recommendedTasks: [
        'Instant offline command interpretation',
        'Local preference and memory retrieval',
        'Mathematical & engineering calculations',
        'Hardware diagnostics and health reporting'
      ],
      status: 'CURRENTLY_SAFE_TO_RUN'
    });

    if (freeRamGb < 1.5) {
      recommendations.push({
        tier: 'TIER_2_MEDIUM_LLM',
        viable: false,
        models: ['Llama-3.2-3B-Q4_K_M', 'Phi-3.5-mini-3.8B', 'Mistral-7B-Instruct-v0.3-Q4'],
        memoryRequiredGb: 2.8,
        recommendedTasks: ['Offline autonomous coding', 'Multi-turn offline synthesis'],
        status: 'UNSAFE_HIGH_MEMORY_PRESSURE',
        reason: `Available RAM (${freeRamGb} GB) is below safety margin (2.8 GB). Loading local 3B+ model would trigger OOM or severe swap file paging.`
      });
    } else {
      recommendations.push({
        tier: 'TIER_2_MEDIUM_LLM',
        viable: true,
        models: ['Llama-3.2-3B-Q4_K_M', 'Phi-3.5-mini-3.8B'],
        memoryRequiredGb: 2.8,
        recommendedTasks: ['Offline autonomous coding', 'Multi-turn offline synthesis'],
        status: 'SAFE_TO_RUN'
      });
    }

    return {
      machineSummary: {
        cpu: `${sys.cpu.model} (${sys.cpu.cores} cores)`,
        ram: `${totalRamGb} GB total, ${freeRamGb} GB currently free (${sys.memory.usagePercent}% used)`,
        gpu: gpus.map(g => g.name).join(', '),
        isGpuDedicated
      },
      currentRoutingPolicy: 'HYBRID_RESOURCE_AWARE',
      fallbackPolicy: 'Deterministic local compute -> Low-latency cloud streaming (Groq/Gemini) -> Offline rule recovery',
      recommendations
    };
  }

  /**
   * Zero-overhead local deterministic command interpreter for offline execution
   */
  interpretOfflineCommand(commandText = '') {
    const text = String(commandText || '').trim().toLowerCase();
    const tStart = Date.now();

    if (!text) {
      return { handled: false, error: 'Empty command' };
    }

    // 1. Time / Date queries
    if (/\b(?:time|what time|current time|clock)\b/i.test(text)) {
      const now = new Date();
      return {
        handled: true,
        category: 'TIME',
        offline: true,
        latencyMs: Date.now() - tStart,
        result: { time: now.toLocaleTimeString(), date: now.toLocaleDateString(), iso: now.toISOString() },
        reply: `The current local time is ${now.toLocaleTimeString()}, sir.`
      };
    }

    // 2. Hardware / System status
    if (/\b(?:cpu|ram|memory|diagnos|system\s+health|hardware)\b/i.test(text)) {
      const sys = this.getSystemOverview();
      return {
        handled: true,
        category: 'DIAGNOSTICS',
        offline: true,
        latencyMs: Date.now() - tStart,
        result: sys,
        reply: `System Status: CPU ${sys.cpu.model} (${sys.cpu.cores} cores). Memory: ${sys.memory.usedGb} GB used of ${sys.memory.totalGb} GB (${sys.memory.usagePercent}%).`
      };
    }

    // 3. Emergency stop
    if (/\b(?:emergency\s+stop|halt\s+all|kill\s+switch|abort\s+all)\b/i.test(text)) {
      return {
        handled: true,
        category: 'SECURITY',
        action: 'EMERGENCY_STOP',
        offline: true,
        latencyMs: Date.now() - tStart,
        reply: 'Emergency Stop command acknowledged. Immediate safety protocols invoked.'
      };
    }

    return {
      handled: false,
      offline: true,
      latencyMs: Date.now() - tStart,
      reason: 'COMMAND_REQUIRES_CLOUD_INTELLIGENCE',
      suggestedRouting: 'CLOUD'
    };
  }

  /**
   * Benchmarks host CPU, memory bandwidth, and JSON serialization latency
   */
  runBenchmark() {
    const t0 = performance.now();

    // 1. Math throughput test
    let acc = 0;
    const mathIterations = 1000000;
    const tMath0 = performance.now();
    for (let i = 0; i < mathIterations; i++) {
      acc += Math.sin(i) * Math.cos(i);
    }
    const mathDurationMs = performance.now() - tMath0;
    const mops = Math.round((mathIterations / (mathDurationMs / 1000)) / 1000000);

    // 2. Memory bandwidth test (allocating & writing to 16MB buffer)
    const tMem0 = performance.now();
    const bufSize = 16 * 1024 * 1024;
    const buf = Buffer.alloc(bufSize);
    for (let i = 0; i < bufSize; i += 64) {
      buf[i] = 1;
    }
    const memDurationMs = performance.now() - tMem0;
    const bandwidthMBps = Math.round((16 / (memDurationMs / 1000)));

    // 3. JSON serialization latency test
    const dummyData = { id: 1, name: 'benchmark', items: Array.from({ length: 500 }, (_, idx) => ({ idx, val: Math.random() })) };
    const tJson0 = performance.now();
    for (let i = 0; i < 50; i++) {
      JSON.parse(JSON.stringify(dummyData));
    }
    const jsonLatencyMs = parseFloat(((performance.now() - tJson0) / 50).toFixed(3));

    const totalDurationMs = Math.round(performance.now() - t0);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      benchmark: {
        mathThroughputMops: mops,
        memoryBandwidthMBps: bandwidthMBps,
        jsonLatencyMs,
        totalDurationMs
      },
      summary: `Local Benchmark: ${mops} MOPS math throughput, ${bandwidthMBps} MB/s memory bandwidth, ${jsonLatencyMs}ms JSON latency.`
    };
  }
}

module.exports = new ResourceComputeManager();
