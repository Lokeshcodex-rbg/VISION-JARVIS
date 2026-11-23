/**
 * VISION — MADE BY LOKESH | JARVIS Owned Neural Foundation Brain Service (`server/neural/neuralBrainService.js`)
 * Coordinates:
 *   - Owned PyTorch Multimodal Transformer + Vision Patch Encoder + Custom BPE Tokenizer
 *   - Provenance-tracked dataset curation from JARVIS's shared memory & Knowledge Graph
 *   - 4-stage training pipeline (Pretraining -> SFT -> Multimodal Vision Fusion -> DPO Alignment)
 *   - Held-out evaluation & regression gate (never displacing a stronger production model prematurely)
 *   - Checkpoint versioning, promotion, rollback, and local serving
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile, spawn } = require('child_process');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const REPO_ROOT = path.resolve(__dirname, '../..');
const NEURAL_DIR = path.join(REPO_ROOT, 'data', 'neural_models');
const CHECKPOINTS_DIR = path.join(NEURAL_DIR, 'checkpoints');
const REGISTRY_FILE = path.join(NEURAL_DIR, 'neural_registry.json');
const INFERENCE_SCRIPT = path.join(REPO_ROOT, 'ml_foundation', 'inference.py');
const WORKER_SCRIPT = path.join(REPO_ROOT, 'ml_foundation', 'worker.py');

class NeuralBrainService {
  constructor() {
    this.pythonExe = this._resolvePythonExecutable();
    this.registry = this._loadOrInitRegistry();
    this.workerProc = null;
    this.workerPort = null;
    this.workerReadyPromise = null;
    this.workerRestartCount = 0;
    this.workerLastError = null;
    process.once('exit', () => {
      this._killWorkerSync();
    });
  }

  _resolvePythonExecutable() {
    const venvWin = path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe');
    const venvPosix = path.join(REPO_ROOT, '.venv', 'bin', 'python');
    if (fs.existsSync(venvWin)) return venvWin;
    if (fs.existsSync(venvPosix)) return venvPosix;
    return 'python';
  }

  _ensureDirs() {
    if (!fs.existsSync(NEURAL_DIR)) fs.mkdirSync(NEURAL_DIR, { recursive: true });
    if (!fs.existsSync(CHECKPOINTS_DIR)) fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  }

  _loadOrInitRegistry() {
    this._ensureDirs();
    if (fs.existsSync(REGISTRY_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        if (!parsed.brand || parsed.brand === 'LOKESH' || parsed.brand === 'STARK') {
          parsed.brand = 'VISION — MADE BY LOKESH';
          parsed.aiBrand = 'VISION';
          parsed.brandSignature = 'MADE BY LOKESH';
          parsed.assistantIdentity = 'JARVIS';
          parsed.productIdentity = 'JARVIS, powered by VISION';
        }
        this._discoverExistingCheckpoints(parsed);
        this._saveRegistry(parsed);
        return parsed;
      } catch (_) {}
    }

    const initial = {
      brand: 'VISION — MADE BY LOKESH',
      aiBrand: 'VISION',
      brandSignature: 'MADE BY LOKESH',
      assistantIdentity: 'JARVIS',
      productIdentity: 'JARVIS, powered by VISION',
      architecture: 'JarvisUnifiedTransformer + JarvisVisionPatchEncoder',
      productionPrimaryModel: 'gemini-2.5-pro / gemini-3.5-flash (teacher & production router)',
      activeExperimentalCheckpoint: null,
      previousStableCheckpoints: [],
      checkpoints: {},
      promotionHistory: [],
      weaknessSignals: [],
      updatedAt: new Date().toISOString()
    };
    this._discoverExistingCheckpoints(initial);
    this._saveRegistry(initial);
    return initial;
  }

  _discoverExistingCheckpoints(reg) {
    if (!fs.existsSync(CHECKPOINTS_DIR)) return;
    for (const dirName of fs.readdirSync(CHECKPOINTS_DIR)) {
      const ckptPath = path.join(CHECKPOINTS_DIR, dirName);
      const weightsPath = path.join(ckptPath, 'weights.pt');
      if (!fs.existsSync(weightsPath)) continue;

      let trainReport = null;
      let evalReport = null;
      try {
        const trFile = path.join(ckptPath, 'training_report.json');
        if (fs.existsSync(trFile)) trainReport = JSON.parse(fs.readFileSync(trFile, 'utf8'));
      } catch (_) {}
      try {
        const evFile = path.join(ckptPath, 'evaluation_report.json');
        if (fs.existsSync(evFile)) evalReport = JSON.parse(fs.readFileSync(evFile, 'utf8'));
      } catch (_) {}

      const existing = reg.checkpoints[dirName] || {};
      const defaultStatus = (evalReport && evalReport.experimental_promotion_eligible) ? 'STAGED_EXPERIMENTAL' : 'TRAINED_UNPROMOTED';
      reg.checkpoints[dirName] = {
        ...existing,
        version: dirName,
        checkpointDir: ckptPath,
        weightsPath,
        weightsBytes: fs.statSync(weightsPath).size,
        trainingReport: existing.trainingReport || trainReport,
        evaluationReport: existing.evaluationReport || evalReport,
        status: existing.status || defaultStatus,
        discoveredAt: existing.discoveredAt || new Date().toISOString()
      };

      if (!reg.activeExperimentalCheckpoint && evalReport && evalReport.experimental_promotion_eligible) {
        reg.activeExperimentalCheckpoint = dirName;
        reg.checkpoints[dirName].status = 'ACTIVE_EXPERIMENTAL';
      }
    }
  }

  _saveRegistry(reg = this.registry) {
    this._ensureDirs();
    reg.updatedAt = new Date().toISOString();
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2), 'utf8');
  }

  _runPythonCli(args = [], timeoutMs = 120000) {
    return new Promise((resolve) => {
      execFile(this.pythonExe, [INFERENCE_SCRIPT, ...args], { cwd: REPO_ROOT, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          return resolve({ success: false, error: err.message, stderr: (stderr || '').slice(-800) });
        }
        try {
          const lines = String(stdout || '').trim().split(/\r?\n/).filter(Boolean);
          const parsed = JSON.parse(lines[lines.length - 1]);
          resolve(parsed);
        } catch (parseErr) {
          resolve({ success: false, error: `Invalid CLI JSON: ${parseErr.message}`, raw: String(stdout || '').slice(0, 600) });
        }
      });
    });
  }

  _killWorkerSync() {
    if (this.workerProc && !this.workerProc.killed) {
      try {
        this.workerProc.kill();
      } catch (_) {}
    }
    this.workerProc = null;
    this.workerPort = null;
  }

  _workerHttpRequest(method, routePath, bodyObj = null, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      if (!this.workerPort) {
        return reject(new Error('WORKER_NOT_RUNNING'));
      }
      const payload = bodyObj !== null ? Buffer.from(JSON.stringify(bodyObj), 'utf8') : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.workerPort,
          path: routePath,
          method,
          timeout: timeoutMs,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) }
            : {}
        },
        (res) => {
          const chunks = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(raw || '{}');
              resolve({ statusCode: res.statusCode || 200, data: parsed });
            } catch (err) {
              reject(new Error(`Invalid worker JSON (${res.statusCode}): ${err.message}`));
            }
          });
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error('WORKER_HTTP_TIMEOUT'));
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async _ensureWorkerStarted(checkpointDir = '') {
    if (this.workerProc && !this.workerProc.killed && this.workerPort) {
      try {
        const h = await this._workerHttpRequest('GET', '/health', null, 1500);
        if (h.statusCode === 200 && h.data && h.data.ok) {
          return { port: this.workerPort, pid: this.workerProc.pid, reused: true };
        }
      } catch (_) {}
      await this.shutdownWorker();
      this.workerRestartCount += 1;
    }

    if (this.workerReadyPromise) {
      return await this.workerReadyPromise;
    }

    this.workerReadyPromise = new Promise((resolve, reject) => {
      const args = [WORKER_SCRIPT, '--max-queue-size', '16', '--max-rss-mb', '1536'];
      if (checkpointDir) {
        args.push('--checkpoint-dir', checkpointDir);
      }
      const proc = spawn(this.pythonExe, args, {
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      this.workerProc = proc;

      let resolved = false;
      let stdoutBuf = '';
      let stderrTail = '';
      const startupTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.workerReadyPromise = null;
          this.workerLastError = 'Worker startup timeout';
          this._killWorkerSync();
          reject(new Error(`Persistent worker failed to become ready within 30s: ${stderrTail.slice(-400)}`));
        }
      }, 30000);

      proc.stdout.on('data', (chunk) => {
        if (resolved) return;
        stdoutBuf += chunk.toString('utf8');
        const lines = stdoutBuf.split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith('WORKER_READY ')) {
            try {
              const info = JSON.parse(line.slice('WORKER_READY '.length));
              this.workerPort = Number(info.port);
              this.workerLastError = null;
              resolved = true;
              clearTimeout(startupTimer);
              this.workerReadyPromise = null;
              resolve({ port: this.workerPort, pid: info.pid || proc.pid, reused: false, ...info });
              return;
            } catch (err) {
              stderrTail += `WORKER_READY parse error: ${err.message}\n`;
            }
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderrTail = (stderrTail + chunk.toString('utf8')).slice(-1500);
      });

      proc.on('exit', (code, sig) => {
        clearTimeout(startupTimer);
        if (this.workerProc === proc) {
          this.workerProc = null;
          this.workerPort = null;
          this.workerReadyPromise = null;
        }
        if (!resolved) {
          resolved = true;
          this.workerLastError = `Worker exited prematurely (code=${code}, sig=${sig}): ${stderrTail.slice(-400)}`;
          reject(new Error(this.workerLastError));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(startupTimer);
        if (!resolved) {
          resolved = true;
          this.workerReadyPromise = null;
          this.workerLastError = err.message;
          reject(err);
        }
      });
    });

    return await this.workerReadyPromise;
  }

  async getWorkerHealth() {
    if (!this.workerProc || this.workerProc.killed || !this.workerPort) {
      return {
        ok: false,
        running: false,
        pid: null,
        port: null,
        restartCount: this.workerRestartCount,
        lastError: this.workerLastError
      };
    }
    try {
      const res = await this._workerHttpRequest('GET', '/health', null, 2000);
      return {
        running: true,
        restartCount: this.workerRestartCount,
        lastError: this.workerLastError,
        ...res.data
      };
    } catch (err) {
      return {
        ok: false,
        running: false,
        pid: this.workerProc ? this.workerProc.pid : null,
        port: this.workerPort,
        restartCount: this.workerRestartCount,
        lastError: err.message
      };
    }
  }

  async cancelInference(requestId) {
    if (!requestId || !this.workerPort) {
      return { success: false, cancelled: false, reason: 'worker_not_running' };
    }
    try {
      const res = await this._workerHttpRequest('POST', '/cancel', { request_id: String(requestId) }, 3000);
      return res.data;
    } catch (err) {
      return { success: false, cancelled: false, error: err.message };
    }
  }

  async shutdownWorker() {
    if (this.workerPort) {
      try {
        await this._workerHttpRequest('POST', '/shutdown', {}, 1500);
      } catch (_) {}
    }
    if (this.workerProc && !this.workerProc.killed) {
      await new Promise((r) => setTimeout(r, 150));
      this._killWorkerSync();
    } else {
      this.workerProc = null;
      this.workerPort = null;
    }
    return { success: true };
  }

  async planTraining(options = {}) {
    const args = [
      'plan',
      '--preset', String(options.preset || 'jarvis-v0.8-research-52m'),
      '--vocab-size', String(options.vocabSize || 32768),
      '--overtrain-multiplier', String(options.overtrainMultiplier || 40.0)
    ];
    return await this._runPythonCli(args, 30000);
  }

  async getReadinessReport(options = {}) {
    const args = ['readiness'];
    if (options.checkpointDir) {
      args.push('--checkpoint-dir', String(options.checkpointDir));
    }
    if (options.outPath) {
      args.push('--out-path', String(options.outPath));
    }
    return await this._runPythonCli(args, 120000);
  }

  async getLocalAudit() {
    return await this._runPythonCli(['local-audit'], 45000);
  }

  async runLocalLadder(options = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      return { success: false, error: 'EMERGENCY_STOP_ACTIVE: Local ladder training halted.' };
    }
    const args = ['local-ladder'];
    if (options.tiers) args.push('--tiers', String(Array.isArray(options.tiers) ? options.tiers.join(',') : options.tiers));
    if (options.stepsScale != null) args.push('--steps-scale', String(options.stepsScale));
    if (options.maxMinutes != null) args.push('--max-minutes', String(options.maxMinutes));
    if (options.threads != null) args.push('--threads', String(options.threads));
    if (options.runTag) args.push('--run-tag', String(options.runTag));
    if (options.ingestHfPilot) args.push('--ingest-hf-pilot');
    const timeoutMs = Number(options.timeoutMs) || 1800000;
    const res = await this._runPythonCli(args, timeoutMs);
    if (res && res.success) {
      this._discoverExistingCheckpoints(this.registry);
      this._saveRegistry();
    }
    return res;
  }

  getStatus() {
    // Refresh registry in case checkpoints were written directly on disk
    this._discoverExistingCheckpoints(this.registry);
    const activeVersion = this.registry.activeExperimentalCheckpoint;
    const activeInfo = activeVersion ? this.registry.checkpoints[activeVersion] : null;
    const checkpointList = Object.values(this.registry.checkpoints).map(c => ({
      version: c.version,
      status: c.status,
      weightsBytes: c.weightsBytes,
      parameters: c.trainingReport?.parameters || c.evaluationReport?.parameters || null,
      vocabSize: c.trainingReport?.tokenizer?.vocab_size || null,
      weightsSha256: c.trainingReport?.artifacts?.weights_sha256 || null,
      metrics: c.evaluationReport?.metrics || c.trainingReport?.training_metrics || null,
      compositeScore: c.evaluationReport?.composite_score ?? null,
      productionPrimaryEligible: Boolean(c.evaluationReport?.production_primary_eligible),
      evaluatedAt: c.evaluationReport?.evaluated_at || null
    }));

    let realMultimodalBenchmarks = null;
    try {
      const mmRepPath = path.join(NEURAL_DIR, 'real_multimodal', 'real_multimodal_report.json');
      if (fs.existsSync(mmRepPath)) {
        realMultimodalBenchmarks = JSON.parse(fs.readFileSync(mmRepPath, 'utf8'));
      }
    } catch (_) {}

    return {
      success: true,
      brand: this.registry.brand || 'VISION — MADE BY LOKESH',
      aiBrand: this.registry.aiBrand || 'VISION',
      brandSignature: this.registry.brandSignature || 'MADE BY LOKESH',
      assistantIdentity: this.registry.assistantIdentity || 'JARVIS',
      productIdentity: this.registry.productIdentity || 'JARVIS, powered by VISION',
      pythonExecutable: this.pythonExe,
      architecture: this.registry.architecture,
      productionPrimaryModel: this.registry.productionPrimaryModel,
      activeExperimentalCheckpoint: activeVersion,
      activeExperimentalReady: Boolean(activeInfo && fs.existsSync(activeInfo.weightsPath)),
      productionReplaced: false, // Honest policy: nano checkpoints never blindly replace production frontier models
      previousStableCheckpoints: this.registry.previousStableCheckpoints,
      checkpointCount: checkpointList.length,
      checkpoints: checkpointList,
      realMultimodalBenchmarks,
      promotionHistory: this.registry.promotionHistory.slice(0, 15),
      weaknessSignals: this.registry.weaknessSignals.slice(-10),
      worker: {
        running: Boolean(this.workerProc && !this.workerProc.killed && this.workerPort),
        pid: this.workerProc ? this.workerProc.pid : null,
        port: this.workerPort,
        restartCount: this.workerRestartCount,
        lastError: this.workerLastError
      },
      updatedAt: this.registry.updatedAt
    };
  }

  /**
   * Explicit multimodal architecture & hardware trade-off comparison across owned neural core,
   * native local sensors (OpenCV + WinRT OCR), and temporary external frontier LLM/VLM teachers.
   */
  getMultimodalArchitectureReport() {
    const status = this.getStatus();
    const activeInfo = this.registry.checkpoints[status.activeExperimentalCheckpoint] || null;
    const cpuThreads = require('os').cpus().length;
    const totalRamGb = Number((require('os').totalmem() / (1024 ** 3)).toFixed(1));
    return {
      success: true,
      brand: status.brand,
      productIdentity: status.productIdentity,
      architecture: status.architecture,
      chosenApproach: {
        design: 'Early-Fusion Multimodal Decoder Transformer (JarvisUnifiedTransformer + JarvisVisionPatchEncoder + JarvisAudioFeatureEncoder)',
        rationale: [
          'Shared decoder parameter space enables native cross-modal attention across visual patch tokens, audio spectral tokens, and BPE text tokens without fragmented adapter glue.',
          'CPU-feasible nano preset (~1.38M parameters, ~5.5MB weights) verifies tokenizer, training stages, DPO alignment, calibration ECE, and local inference end-to-end before GPU scaling.',
          'AMP mixed precision (CUDA FP16/BF16, CPU FP32 safe), gradient accumulation, cosine warmup LR, and checkpoint resumption scale cleanly to multi-GPU PyTorch/DDP.'
        ]
      },
      alternativesCompared: [
        {
          option: 'Separate VLM/LLM/Audio Pipelines (Late Adapter Silos)',
          tradeoff: 'Easier isolated tuning, higher orchestration complexity, weaker shared spatial-linguistic grounding.'
        },
        {
          option: 'Pure External Cloud API Dependency',
          tradeoff: 'Immediate frontier accuracy today, zero model ownership, privacy/network dependency, and recurrent API cost.'
        }
      ],
      componentRoles: {
        ownedNeuralCore: {
          checkpoint: status.activeExperimentalCheckpoint || 'none',
          parameters: activeInfo?.trainingReport?.parameters || activeInfo?.evaluationReport?.parameters || null,
          role: 'EXPERIMENTAL_LOCAL_SUBSYSTEM',
          suitability: 'Controlled experimentation, local token/patch/audio encoding, held-out benchmark tracking, and dataset distillation.'
        },
        nativeVisionSensors: {
          stack: 'OpenCV contour/segmentation/spatial/anomaly analysis + Windows WinRT OCR',
          role: 'PRODUCTION_LOCAL_PERCEPTION',
          suitability: 'Deterministic geometry, foreground ratios, spatial relations, blur/anomaly checks, and offline printed/screen text extraction.'
        },
        externalFrontierModels: {
          models: status.productionPrimaryModel,
          role: 'PRODUCTION_PRIMARY_TEACHER',
          suitability: 'Complex open-ended reasoning, coding, and fine-grained image understanding while owned neural weights scale.'
        }
      },
      hardwareConstraints: {
        accelerator: 'CPU-only (no CUDA GPU present on host; Intel Iris Xe iGPU not CUDA-compatible for PyTorch CUDA AMP)',
        cpuLogicalCores: cpuThreads,
        systemMemoryGb: totalRamGb,
        scalingRequirement: '125M+ / 1B+ parameter training requires NVIDIA CUDA GPUs (>=24GB VRAM or multi-node DDP).'
      },
      generatedAt: new Date().toISOString()
    };
  }

  recordWeaknessSignal(signal = {}) {
    if (!signal || !signal.area) return;
    this.registry.weaknessSignals.push({
      area: String(signal.area),
      detail: String(signal.detail || '').slice(0, 240),
      source: signal.source || 'evaluation',
      recordedAt: new Date().toISOString()
    });
    if (this.registry.weaknessSignals.length > 50) {
      this.registry.weaknessSignals = this.registry.weaknessSignals.slice(-50);
    }
    this._saveRegistry();
  }

  recordVerifiedFeedback({ domain = 'general', accepted = false, prompt = '', detail = '', source = 'runtime' } = {}) {
    if (!accepted) {
      this.recordWeaknessSignal({
        area: `verified_feedback:${domain}`,
        detail: detail || String(prompt || '').slice(0, 180),
        source: String(source || 'runtime')
      });
    }
    return { success: true, recorded: !accepted, domain };
  }

  /**
   * Trains a new versioned checkpoint of JARVIS's owned multimodal model
   */
  async trainCandidateCheckpoint(options = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      return { success: false, error: 'EMERGENCY_STOP_ACTIVE: Neural training halted.' };
    }

    const version = String(options.version || `jarvis-v${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const preset = String(options.preset || 'jarvis-nano-multimodal');
    const args = [
      'train',
      '--version', version,
      '--preset', preset,
      '--vocab-size', String(options.vocabSize || 900),
      '--pretrain-steps', String(options.pretrainSteps || 40),
      '--sft-steps', String(options.sftSteps || 50),
      '--vision-steps', String(options.visionSteps || 55),
      '--dpo-steps', String(options.dpoSteps || 20)
    ];
    if (options.gradAccumSteps) {
      args.push('--grad-accum-steps', String(options.gradAccumSteps));
    }
    if (options.resumeFrom) {
      args.push('--resume-from', String(options.resumeFrom));
    }
    if (options.dtype) {
      args.push('--dtype', String(options.dtype));
    }
    if (options.earlyStopping === false) {
      args.push('--no-early-stopping');
    }
    if (options.earlyStopPatience) {
      args.push('--early-stop-patience', String(options.earlyStopPatience));
    }
    if (options.allowLargeCpu) {
      args.push('--allow-large-cpu');
    }
    if (options.stopAfterStage) {
      args.push('--stop-after-stage', String(options.stopAfterStage));
    }
    if (options.stopAfterStep) {
      args.push('--stop-after-step', String(options.stopAfterStep));
    }
    if (options.optimizer) {
      args.push('--optimizer', String(options.optimizer));
    }
    if (options.seqLen) {
      args.push('--seq-len', String(options.seqLen));
    }
    if (options.microBatchSize) {
      args.push('--micro-batch-size', String(options.microBatchSize));
    }
    if (options.gradientCheckpointing) {
      args.push('--gradient-checkpointing');
    }
    if (options.threads) {
      args.push('--threads', String(options.threads));
    }
    if (options.shardDir) {
      args.push('--shard-dir', String(options.shardDir));
    }

    const timeoutMs = Number(options.timeoutMs) || (preset.includes('micro') ? 600000 : 240000);
    const trainRes = await this._runPythonCli(args, timeoutMs);
    if (!trainRes || !trainRes.success) {
      return { success: false, error: trainRes?.error || 'Training failed', details: trainRes };
    }

    const ckptDir = trainRes.artifacts.checkpoint_dir;
    this.registry.checkpoints[version] = {
      version,
      checkpointDir: ckptDir,
      weightsPath: trainRes.artifacts.weights_path,
      weightsBytes: trainRes.artifacts.weights_bytes,
      trainingReport: trainRes,
      evaluationReport: null,
      status: 'TRAINED_UNPROMOTED',
      createdAt: new Date().toISOString()
    };
    this._saveRegistry();

    return {
      success: true,
      verified: true,
      version,
      trainingReport: trainRes
    };
  }

  /**
   * Runs held-out validation, multimodal vision evaluation, DPO alignment margin check,
   * and regression comparison against the active baseline checkpoint.
   */
  async evaluateCheckpoint(version = null) {
    const targetVersion = version || this.registry.activeExperimentalCheckpoint || Object.keys(this.registry.checkpoints)[0];
    if (!targetVersion || !this.registry.checkpoints[targetVersion]) {
      return { success: false, error: `Checkpoint "${targetVersion || ''}" not found.` };
    }

    const entry = this.registry.checkpoints[targetVersion];
    const baselineVersion = this.registry.activeExperimentalCheckpoint;
    const prevEval = (baselineVersion && baselineVersion !== targetVersion && this.registry.checkpoints[baselineVersion]?.evaluationReport)
      ? this.registry.checkpoints[baselineVersion].evaluationReport
      : null;

    const args = ['eval', '--checkpoint-dir', entry.checkpointDir];
    if (prevEval) {
      args.push('--prev-eval-json', JSON.stringify({
        composite_score: prevEval.composite_score,
        metrics: {
          vision_val_accuracy: prevEval.metrics?.vision_val_accuracy,
          sft_val_perplexity: prevEval.metrics?.sft_val_perplexity
        },
        parameters: prevEval.parameters
      }));
    }

    const evalRes = await this._runPythonCli(args, 120000);
    if (!evalRes || !evalRes.success) {
      return { success: false, error: evalRes?.error || 'Evaluation failed' };
    }

    entry.evaluationReport = evalRes;
    if (evalRes.regression_detected) {
      this.recordWeaknessSignal({
        area: `checkpoint_regression:${targetVersion}`,
        detail: `Composite ${evalRes.composite_score} regressed below baseline`,
        source: 'evaluator'
      });
    }
    this._saveRegistry();

    return {
      success: true,
      verified: true,
      version: targetVersion,
      parameters: evalRes.parameters,
      metrics: evalRes.metrics,
      compositeScore: evalRes.composite_score,
      evaluationReport: evalRes
    };
  }

  /**
   * Controlled gated promotion:
   * - Experimental checkpoints promote to ACTIVE_EXPERIMENTAL ONLY if eval passes & no regression.
   * - Production primary LLM/VLM is NEVER replaced unless production_primary_eligible is genuinely true.
   */
  async promoteCheckpoint(version, { targetRole = 'experimental' } = {}) {
    const entry = this.registry.checkpoints[version];
    if (!entry) {
      return { success: false, promoted: false, error: `Unknown checkpoint version: ${version}` };
    }

    if (!entry.evaluationReport) {
      const ev = await this.evaluateCheckpoint(version);
      if (!ev.success) return { success: false, promoted: false, error: ev.error };
    }

    const ev = entry.evaluationReport;
    if (targetRole === 'production_primary' && !ev.production_primary_eligible) {
      return {
        success: true,
        promoted: false,
        gateBlocked: true,
        reason: `SAFETY_AND_QUALITY_GATE: ${ev.production_gate_reason}`,
        activeProductionModel: this.registry.productionPrimaryModel,
        evaluationReport: ev
      };
    }

    if (!ev.experimental_promotion_eligible || ev.regression_detected) {
      return {
        success: true,
        promoted: false,
        gateBlocked: true,
        reason: ev.regression_detected
          ? 'Regression detected compared to previous checkpoint; promotion blocked.'
          : 'Held-out evaluation metrics below experimental acceptance threshold.',
        evaluationReport: ev
      };
    }

    const prev = this.registry.activeExperimentalCheckpoint;
    if (prev && prev !== version && this.registry.checkpoints[prev]) {
      this.registry.checkpoints[prev].status = 'STABLE_ARCHIVE';
      if (!this.registry.previousStableCheckpoints.includes(prev)) {
        this.registry.previousStableCheckpoints.push(prev);
      }
    }

    this.registry.activeExperimentalCheckpoint = version;
    entry.status = 'ACTIVE_EXPERIMENTAL';
    this.registry.promotionHistory.unshift({
      timestamp: new Date().toISOString(),
      action: 'PROMOTE_EXPERIMENTAL',
      fromVersion: prev || null,
      toVersion: version,
      compositeScore: ev.composite_score,
      productionPrimaryReplaced: false
    });
    this._saveRegistry();

    return {
      success: true,
      promoted: true,
      role: 'ACTIVE_EXPERIMENTAL',
      version,
      previousVersion: prev || null,
      activeProductionModel: this.registry.productionPrimaryModel,
      evaluationReport: ev
    };
  }

  rollbackCheckpoint(toVersion = null) {
    const target = toVersion || this.registry.previousStableCheckpoints[this.registry.previousStableCheckpoints.length - 1];
    if (!target || !this.registry.checkpoints[target]) {
      return { success: false, error: 'No previous stable checkpoint available for rollback.' };
    }
    const current = this.registry.activeExperimentalCheckpoint;
    if (current && this.registry.checkpoints[current]) {
      this.registry.checkpoints[current].status = 'ROLLED_BACK';
    }
    this.registry.activeExperimentalCheckpoint = target;
    this.registry.checkpoints[target].status = 'ACTIVE_EXPERIMENTAL';
    this.registry.promotionHistory.unshift({
      timestamp: new Date().toISOString(),
      action: 'ROLLBACK',
      fromVersion: current || null,
      toVersion: target
    });
    this._saveRegistry();

    return {
      success: true,
      rolledBackFrom: current || null,
      activeExperimentalCheckpoint: target
    };
  }

  /**
   * Distills verified experiences (`experiences_index.json`), Knowledge Graph facts,
   * and hardware inventory into provenance-tracked multimodal datasets without contamination.
   */
  async distillVerifiedExperiences({ version = null } = {}) {
    const tag = String(version || `distilled-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '-');
    const res = await this._runPythonCli(['distill', '--version', tag], 45000);
    if (res && res.success) {
      this.registry.lastDistilledDataset = {
        version: tag,
        distilledAt: new Date().toISOString(),
        counts: res.counts || {},
        audit: res.data_processing_audit || {},
        manifestPath: res.manifest_path || null,
      };
      this._saveRegistry();
    }
    return {
      success: Boolean(res?.success),
      version: tag,
      counts: res?.counts || {},
      data_processing_audit: res?.data_processing_audit || {},
      manifest_path: res?.manifest_path || null,
    };
  }

  /**
   * Benchmarks actual CPU/GPU throughput, memory RSS, KV-cache speedup, and larger preset scaling bounds.
   */
  async benchmarkHardware(options = {}) {
    const args = [
      'benchmark',
      '--vocab-size', String(options.vocabSize || 2048),
      '--seq-len', String(options.seqLen || 128)
    ];
    return await this._runPythonCli(args, 120000);
  }

  /**
   * Runs real neural inference on JARVIS's owned Transformer + Vision + Audio Encoders.
   */
  async inferWithOwnedBrain({
    prompt = '',
    imagePath = null,
    imageBase64 = null,
    audioPath = null,
    audioBase64 = null,
    version = null,
    maxTokens = 48,
    maxNewTokens = null,
    signal = null,
    requestId = null,
    useWorker = true
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      return { success: false, error: 'EMERGENCY_STOP_ACTIVE' };
    }

    this._discoverExistingCheckpoints(this.registry);
    const targetVersion = version || (
      this.registry.checkpoints['vision-100m-foundation'] ? 'vision-100m-foundation' :
      (this.registry.checkpoints['vision-2.0-candidate-g'] ? 'vision-2.0-candidate-g' :
      (this.registry.checkpoints['vision-v1.4-experimental-local'] ? 'vision-v1.4-experimental-local' :
      (this.registry.checkpoints['vision-v1.3-experimental-local'] ? 'vision-v1.3-experimental-local' :
      (this.registry.activeExperimentalCheckpoint || Object.keys(this.registry.checkpoints)[0]))))
    );
    if (!targetVersion || !this.registry.checkpoints[targetVersion]) {
      return { success: false, error: 'No trained owned checkpoint found yet. Run training pipeline first.' };
    }

    let resolvedImagePath = imagePath;
    let resolvedAudioPath = audioPath;
    let tempImageCreated = false;
    let tempAudioCreated = false;
    const scratchDir = path.join(REPO_ROOT, 'scratch');

    if (!resolvedImagePath && imageBase64) {
      if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
      const cleanB64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '').trim();
      resolvedImagePath = path.join(scratchDir, `neural_vision_tmp_${Date.now()}.png`);
      fs.writeFileSync(resolvedImagePath, Buffer.from(cleanB64, 'base64'));
      tempImageCreated = true;
    }

    if (!resolvedAudioPath && audioBase64) {
      if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
      const cleanAudB64 = String(audioBase64).replace(/^data:audio\/[\w+.-]+;base64,/, '').trim();
      resolvedAudioPath = path.join(scratchDir, `neural_audio_tmp_${Date.now()}.wav`);
      fs.writeFileSync(resolvedAudioPath, Buffer.from(cleanAudB64, 'base64'));
      tempAudioCreated = true;
    }

    const reqId = requestId || randomUUID().slice(0, 12);
    let abortHandler = null;
    try {
      const ckptDir = this.registry.checkpoints[targetVersion].checkpointDir;
      const defaultPrompt = resolvedAudioPath && !resolvedImagePath
        ? 'Classify incoming acoustic waveform'
        : (resolvedImagePath ? 'Inspect visual component' : 'Who are you?');
      const effectivePrompt = String(prompt || defaultPrompt);
      const effectiveMaxTokens = Number(maxNewTokens || maxTokens);

      let res = null;
      if (useWorker !== false) {
        if (signal && signal.aborted) {
          return { success: false, cancelled: true, error: 'INFERENCE_CANCELLED', request_id: reqId };
        }
        if (signal && typeof signal.addEventListener === 'function') {
          abortHandler = () => {
            this.cancelInference(reqId).catch(() => {});
          };
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        const workerBody = {
          request_id: reqId,
          checkpoint_dir: ckptDir,
          prompt: effectivePrompt,
          image_path: resolvedImagePath || '',
          audio_path: resolvedAudioPath || '',
          max_tokens: effectiveMaxTokens,
          temperature: 0.05
        };

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await this._ensureWorkerStarted(ckptDir);
            const httpRes = await this._workerHttpRequest('POST', '/infer', workerBody, 60000);
            res = httpRes.data;
            if (httpRes.statusCode === 503 && res?.error === 'MEMORY_LIMIT_EXCEEDED' && attempt === 0) {
              await this.shutdownWorker();
              this.workerRestartCount += 1;
              continue;
            }
            break;
          } catch (workerErr) {
            this.workerLastError = workerErr.message;
            await this.shutdownWorker();
            this.workerRestartCount += 1;
            if (attempt === 1) {
              res = null;
            }
          }
        }
      }

      if (!res && !(signal && signal.aborted)) {
        const args = [
          'infer',
          '--checkpoint-dir', ckptDir,
          '--prompt', effectivePrompt,
          '--max-tokens', String(effectiveMaxTokens)
        ];
        if (resolvedImagePath) {
          args.push('--image-path', resolvedImagePath);
        }
        if (resolvedAudioPath) {
          args.push('--audio-path', resolvedAudioPath);
        }
        res = await this._runPythonCli(args, 30000);
        if (res && res.success) {
          res.warm_worker = false;
        }
      }

      if (res && res.success) {
        const va = res.vision_analysis || null;
        const aa = res.audio_analysis || null;
        res.checkpoint = res.version || targetVersion;
        res.workerRestartCount = this.workerRestartCount;
        res.text = res.completion || res.text || res.output || '';
        res.output = res.completion || res.text || res.output || '';
        res.visionPrediction = va
          ? {
              top_category: va.predicted_category,
              confidence: va.confidence,
              predicted_bbox_xywh: va.normalized_bbox_cx_cy_w_h,
              top_predictions: va.top_predictions || [],
              embedding_dim: va.embedding_dim || null
            }
          : null;
        res.audioPrediction = aa
          ? {
              top_category: aa.predicted_category,
              confidence: aa.confidence,
              top_predictions: aa.top_predictions || [],
              feature_dim: aa.feature_dim || null
            }
          : null;
      }
      return res;
    } finally {
      if (signal && abortHandler && typeof signal.removeEventListener === 'function') {
        try { signal.removeEventListener('abort', abortHandler); } catch (_) {}
      }
      if (tempImageCreated && resolvedImagePath && fs.existsSync(resolvedImagePath)) {
        try { fs.unlinkSync(resolvedImagePath); } catch (_) {}
      }
      if (tempAudioCreated && resolvedAudioPath && fs.existsSync(resolvedAudioPath)) {
        try { fs.unlinkSync(resolvedAudioPath); } catch (_) {}
      }
    }
  }
}

const neuralBrainServiceInstance = new NeuralBrainService();

module.exports = {
  NeuralBrainService,
  neuralBrainServiceInstance
};
