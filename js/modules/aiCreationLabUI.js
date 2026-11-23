/**
 * VISION AI — AI Creation Lab UI
 * Allows JARVIS to profile compute/VRAM resources, scaffold specialist AI agents
 * with strict permission profiles, design RAG pipelines, and track AI benchmarks.
 */

export class AiCreationLabUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.activeSubTab = 'neural'; // 'neural' | 'profiler' | 'scaffolder' | 'rag'
    this.neuralStatus = null;
    this.neuralLoading = false;
    this.neuralLog = '';

    this.models = [
      { id: 'jarvis-nano-multimodal', name: 'JARVIS Unified Transformer (1.35M Owned CPU)', paramsBillion: 0.0014 },
      { id: 'llama-3-8b', name: 'Llama 3 (8B Parameters)', paramsBillion: 8.0 },
      { id: 'mistral-7b', name: 'Mistral (7B Parameters)', paramsBillion: 7.2 },
      { id: 'gemma-2-9b', name: 'Gemma 2 (9B Parameters)', paramsBillion: 9.2 },
      { id: 'phi-3-mini', name: 'Phi-3 Mini (3.8B Parameters)', paramsBillion: 3.8 }
    ];

    this.selectedModel = this.models[0];
    this.quantization = 'int4'; // 'fp16' | 'int8' | 'int4'
    this.contextLength = 4096;

    this.init();
  }

  init() {
    this.render();
    this.refreshNeuralStatus();
  }

  async _getAuthHeaders() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) {
          return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` };
        }
      }
    } catch (_) {}
    return { 'Content-Type': 'application/json' };
  }

  async refreshNeuralStatus() {
    this.neuralLoading = true;
    try {
      const res = await fetch('/api/neural/status');
      if (res.ok) {
        this.neuralStatus = await res.json();
      }
    } catch (err) {
      this.neuralLog = `Status fetch warning: ${err.message}`;
    } finally {
      this.neuralLoading = false;
      if (this.activeSubTab === 'neural') this.render();
    }
  }

  async _callNeuralEndpoint(endpoint, body = {}) {
    this.neuralLoading = true;
    this.neuralLog = `Running ${endpoint}...`;
    this.render();
    try {
      const headers = await this._getAuthHeaders();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      this.neuralLog = JSON.stringify(data, null, 2);
      await this.refreshNeuralStatus();
    } catch (err) {
      this.neuralLog = `Error: ${err.message}`;
      this.neuralLoading = false;
      this.render();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="ai-creation-layout">
        <!-- Sub-navigation -->
        <div class="ai-lab-header">
          <div class="ai-lab-title">
            <span class="ai-icon">🧠</span>
            <div>
              <h3>VISION — MADE BY LOKESH | Foundation Brain &amp; Training Dashboard</h3>
              <p>JARVIS, powered by VISION: Owned Multimodal Transformer, Tokenizer, Held-Out Eval &amp; Safety-Gated Versioning</p>
            </div>
          </div>
          <div class="ai-sub-tabs">
            <button class="ai-tab-btn ${this.activeSubTab === 'neural' ? 'active' : ''}" data-tab="neural">🧠 Foundation Brain</button>
            <button class="ai-tab-btn ${this.activeSubTab === 'profiler' ? 'active' : ''}" data-tab="profiler">⚡ Compute & VRAM Profiler</button>
            <button class="ai-tab-btn ${this.activeSubTab === 'scaffolder' ? 'active' : ''}" data-tab="scaffolder">🛠️ Specialist Agent Scaffolder</button>
            <button class="ai-tab-btn ${this.activeSubTab === 'rag' ? 'active' : ''}" data-tab="rag">📚 RAG & Retrieval Designer</button>
          </div>
        </div>

        <!-- Tab Body -->
        <div class="ai-tab-body">
          ${this.renderActiveTab()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderActiveTab() {
    if (this.activeSubTab === 'neural') {
      const st = this.neuralStatus;
      const latestCp = st?.checkpoints && st.checkpoints.length > 0 ? st.checkpoints[st.checkpoints.length - 1] : null;
      const metrics = latestCp?.metrics || {};
      return `
        <div class="neural-brain-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div>
              <h4 style="margin:0;">VISION Neural Architecture: ${st?.architecture || 'JarvisUnifiedTransformer + JarvisVisionPatchEncoder'}</h4>
              <p style="margin:4px 0 0;opacity:0.8;font-size:12px;">AI Brand: <strong>${st?.brand || 'VISION — MADE BY LOKESH'}</strong> | Product: <strong>${st?.productIdentity || 'JARVIS, powered by VISION'}</strong> | Production Primary: <strong>${st?.productionPrimaryModel || 'gemini-2.5-pro / gemini-3.5-flash'}</strong> | Active Local Checkpoint: <strong>${st?.activeExperimentalCheckpoint || 'loading...'}</strong></p>
            </div>
            <button id="btn-neural-refresh" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Refresh Status</button>
          </div>

          <div class="vram-results-grid" style="margin-bottom:14px;">
            <div class="vram-metric-card">
              <span class="vram-label">Checkpoints / Params</span>
              <strong class="vram-value">${st?.checkpointCount ?? 0} (${latestCp?.parameters?.total_parameters?.toLocaleString() || '—'} params)</strong>
              <span class="vram-subtext">Vocab: ${latestCp?.vocabSize || '—'} BPE tokens | ${(latestCp?.weightsBytes ? (latestCp.weightsBytes / (1024 * 1024)).toFixed(2) + ' MB' : '—')}</span>
            </div>
            <div class="vram-metric-card">
              <span class="vram-label">Held-Out Vision & Audio</span>
              <strong class="vram-value">V ${metrics.vision_val_accuracy !== undefined ? (metrics.vision_val_accuracy * 100).toFixed(1) + '%' : '—'} | A ${metrics.audio_val_accuracy !== undefined ? (metrics.audio_val_accuracy * 100).toFixed(1) + '%' : '—'}</strong>
              <span class="vram-subtext">Mean IoU: ${metrics.vision_mean_iou ?? '—'} | Composite: ${latestCp?.compositeScore ?? '—'}</span>
            </div>
            <div class="vram-metric-card">
              <span class="vram-label">Alignment & Perplexity</span>
              <strong class="vram-value">Win ${metrics.alignment_win_rate !== undefined ? (metrics.alignment_win_rate * 100).toFixed(0) + '%' : '—'} | PPL ${metrics.sft_val_perplexity ?? '—'}</strong>
              <span class="vram-subtext">CPU Latency: ${metrics.inference_latency_ms ?? '—'} ms (${metrics.ms_per_token ?? '—'} ms/tok)</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
            <button id="btn-neural-eval" class="stark-btn stark-btn-primary" ${this.neuralLoading ? 'disabled' : ''}>Run Held-Out Eval</button>
            <button id="btn-neural-distill" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Distill Data</button>
            <button id="btn-neural-arch" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Architecture Report</button>
            <button id="btn-neural-bench" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Hardware Scale</button>
            <button id="btn-neural-promote-exp" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Promote Experimental</button>
            <button id="btn-neural-promote-prod" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Test Production Gate</button>
            <button id="btn-neural-rollback" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Rollback Checkpoint</button>
            <button id="btn-neural-train" class="stark-btn" ${this.neuralLoading ? 'disabled' : ''}>Train Candidate Epoch</button>
          </div>

          <div style="font-size:12px;opacity:0.85;margin-bottom:8px;">
            ${(st?.checkpoints || []).map(cp => `<div>• <strong>${cp.version}</strong> [${cp.status}] — Vision: ${(cp.metrics?.vision_val_accuracy * 100 || 0).toFixed(0)}%${cp.metrics?.audio_val_accuracy !== undefined ? `, Audio: ${(cp.metrics.audio_val_accuracy * 100).toFixed(0)}%` : ''}, Score: ${cp.compositeScore}, ProdEligible: ${cp.productionPrimaryEligible}</div>`).join('')}
          </div>

          ${this.neuralLog ? `<pre style="max-height:180px;overflow:auto;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;font-size:11px;"><code>${this.neuralLog.replace(/</g, '&lt;')}</code></pre>` : ''}
        </div>
      `;
    }

    if (this.activeSubTab === 'profiler') {
      const vramEst = this.calculateVRAM();
      return `
        <div class="vram-profiler-card">
          <div class="profiler-controls">
            <div class="control-col">
              <label>Target Architecture / Model:</label>
              <select id="model-select" class="ai-select">
                ${this.models.map(m => `
                  <option value="${m.id}" ${m.id === this.selectedModel.id ? 'selected' : ''}>${m.name}</option>
                `).join('')}
              </select>
            </div>

            <div class="control-col">
              <label>Precision / Quantization:</label>
              <select id="quant-select" class="ai-select">
                <option value="int4" ${this.quantization === 'int4' ? 'selected' : ''}>INT4 (GGUF / AWQ — Minimal VRAM)</option>
                <option value="int8" ${this.quantization === 'int8' ? 'selected' : ''}>INT8 (Balanced Quality)</option>
                <option value="fp16" ${this.quantization === 'fp16' ? 'selected' : ''}>FP16 (Half Precision Full Quality)</option>
              </select>
            </div>

            <div class="control-col">
              <label>Context Window (Tokens):</label>
              <select id="context-select" class="ai-select">
                <option value="2048" ${this.contextLength === 2048 ? 'selected' : ''}>2,048 tokens</option>
                <option value="4096" ${this.contextLength === 4096 ? 'selected' : ''}>4,096 tokens</option>
                <option value="8192" ${this.contextLength === 8192 ? 'selected' : ''}>8,192 tokens</option>
                <option value="16384" ${this.contextLength === 16384 ? 'selected' : ''}>16,384 tokens</option>
              </select>
            </div>
          </div>

          <!-- Output Metrics -->
          <div class="vram-results-grid">
            <div class="vram-metric-card highlight">
              <span class="vram-label">Estimated GPU VRAM Required</span>
              <strong class="vram-value">${vramEst.totalVRAMGb} GB</strong>
              <span class="vram-subtext">Weights: ${vramEst.weightsGb} GB | KV-Cache: ${vramEst.kvCacheGb} GB</span>
            </div>

            <div class="vram-metric-card">
              <span class="vram-label">Local Hardware Feasibility</span>
              <strong class="vram-value status-${vramEst.feasibility.toLowerCase()}">${vramEst.feasibility}</strong>
              <span class="vram-subtext">${vramEst.hardwareRecommendation}</span>
            </div>

            <div class="vram-metric-card">
              <span class="vram-label">Estimated Training / Fine-Tuning Compute</span>
              <strong class="vram-value">${vramEst.trainingFlops} FLOPs</strong>
              <span class="vram-subtext">Est. Cloud Cost: ~$${vramEst.cloudCostUSD}</span>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeSubTab === 'scaffolder') {
      return `
        <div class="scaffolder-card">
          <h4>🛠️ Scaffold Specialist AI Agent Profile</h4>
          <p>Generate a purpose-built specialist agent with defined purpose, permission scope, and evaluation metrics.</p>

          <div class="agent-form-grid">
            <label>Agent Name: <input type="text" id="new-agent-name" placeholder="e.g. AvionicsControlSpecialist" value="AvionicsControlSpecialist" /></label>
            <label>Domain:
              <select id="new-agent-domain">
                <option value="Robotics">Robotics & Actuation</option>
                <option value="Electronics">Electronics & Firmware</option>
                <option value="AI">Machine Learning / RAG</option>
                <option value="Software">Software Engineering</option>
              </select>
            </label>
            <label>Permission Level:
              <select id="new-agent-perm">
                <option value="READ_ONLY">READ_ONLY (Safe Analysis)</option>
                <option value="SIMULATION">SIMULATION (Compute & Run Models)</option>
                <option value="DEVELOPMENT_EXEC">DEVELOPMENT_EXEC (Sandbox Code Edits)</option>
              </select>
            </label>
            <label>Evaluation Metric: <input type="text" id="new-agent-eval" value="Trajectory tracking error < 0.05 rad" /></label>
          </div>

          <button id="btn-scaffold-agent" class="stark-btn stark-btn-primary" style="margin-top: 15px;">Generate Agent Scaffold</button>
          <div id="scaffold-result-pre" class="scaffold-result" style="display: none;"></div>
        </div>
      `;
    }

    if (this.activeSubTab === 'rag') {
      return `
        <div class="rag-designer-card">
          <h4>📚 Retrieval-Augmented Generation (RAG) Architecture</h4>
          <p>Configure vector embedding models, chunking strategy, and top-k reranking for technical documentation.</p>
          <div class="rag-params-grid">
            <div class="rag-param-box">
              <strong>Embedding Model:</strong>
              <span>text-embedding-3-small (1536 dim) / BGE-Small-EN</span>
            </div>
            <div class="rag-param-box">
              <strong>Chunking Strategy:</strong>
              <span>512 tokens with 64-token overlap & recursive header split</span>
            </div>
            <div class="rag-param-box">
              <strong>Vector Index:</strong>
              <span>HNSW Cosine Similarity (In-Memory Ring Index)</span>
            </div>
            <div class="rag-param-box">
              <strong>Top-k Retrieval:</strong>
              <span>k = 5 with reciprocal rank fusion (RRF)</span>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  calculateVRAM() {
    const bytesPerParam = this.quantization === 'fp16' ? 2 : (this.quantization === 'int8' ? 1 : 0.5);
    const weightsGb = Number(((this.selectedModel.paramsBillion * 1e9 * bytesPerParam) / (1024 ** 3)).toFixed(1));
    const kvCacheGb = Number(((2 * 32 * (this.contextLength) * 4096 * 2) / (1024 ** 3)).toFixed(2));
    const totalVRAMGb = Number((weightsGb + kvCacheGb + 0.8).toFixed(1)); // +0.8 GB CUDA overhead

    let feasibility = 'FEASIBLE';
    let hardwareRecommendation = 'Runs within local consumer GPU (e.g. RTX 4060 8GB / 3060 12GB)';
    if (totalVRAMGb > 16) {
      feasibility = 'HIGH_COMPUTE';
      hardwareRecommendation = 'Requires dual GPU or 24GB VRAM (RTX 3090/4090 or cloud instance)';
    } else if (totalVRAMGb > 8) {
      feasibility = 'MODERATE';
      hardwareRecommendation = 'Fits in 12GB - 16GB VRAM GPU or Apple Silicon unified memory';
    }

    const trainingFlops = (6 * this.selectedModel.paramsBillion * 1e9 * 1e6).toExponential(2);
    const cloudCostUSD = (this.selectedModel.paramsBillion * 1.8).toFixed(2);

    return {
      weightsGb,
      kvCacheGb,
      totalVRAMGb,
      feasibility,
      hardwareRecommendation,
      trainingFlops,
      cloudCostUSD
    };
  }

  attachEventListeners() {
    this.container.querySelectorAll('.ai-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSubTab = btn.dataset.tab;
        this.render();
      });
    });

    const latestVersion = this.neuralStatus?.activeExperimentalCheckpoint ||
      (this.neuralStatus?.checkpoints?.[this.neuralStatus.checkpoints.length - 1]?.version) ||
      'jarvis-v0.3.0';

    this.container.querySelector('#btn-neural-refresh')?.addEventListener('click', () => this.refreshNeuralStatus());
    this.container.querySelector('#btn-neural-eval')?.addEventListener('click', () => this._callNeuralEndpoint('/api/neural/evaluate', { version: latestVersion }));
    this.container.querySelector('#btn-neural-distill')?.addEventListener('click', () => this._callNeuralEndpoint('/api/neural/distill', {}));
    this.container.querySelector('#btn-neural-arch')?.addEventListener('click', async () => {
      this.neuralLoading = true;
      this.neuralLog = 'Fetching /api/neural/architecture...';
      this.render();
      try {
        const res = await fetch('/api/neural/architecture');
        const data = await res.json();
        this.neuralLog = JSON.stringify(data, null, 2);
      } catch (err) {
        this.neuralLog = `Architecture fetch error: ${err.message}`;
      } finally {
        this.neuralLoading = false;
        this.render();
      }
    });
    this.container.querySelector('#btn-neural-bench')?.addEventListener('click', async () => {
      this.neuralLoading = true;
      this.neuralLog = 'Running Stage 6 Hardware & KV-Cache Benchmark (/api/neural/benchmark)...';
      this.render();
      try {
        const res = await fetch('/api/neural/benchmark');
        const data = await res.json();
        this.neuralLog = JSON.stringify(data, null, 2);
      } catch (err) {
        this.neuralLog = `Hardware benchmark error: ${err.message}`;
      } finally {
        this.neuralLoading = false;
        this.render();
      }
    });
    this.container.querySelector('#btn-neural-promote-exp')?.addEventListener('click', () => this._callNeuralEndpoint('/api/neural/promote', { version: latestVersion, targetRole: 'experimental_local' }));
    this.container.querySelector('#btn-neural-promote-prod')?.addEventListener('click', () => this._callNeuralEndpoint('/api/neural/promote', { version: latestVersion, targetRole: 'production_primary' }));
    this.container.querySelector('#btn-neural-rollback')?.addEventListener('click', () => this._callNeuralEndpoint('/api/neural/rollback', {}));
    this.container.querySelector('#btn-neural-train')?.addEventListener('click', () => this._callNeuralEndpoint('/api/neural/train', {}));

    const modelSelect = this.container.querySelector('#model-select');
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.selectedModel = this.models.find(m => m.id === e.target.value) || this.models[0];
        this.render();
      });
    }

    const quantSelect = this.container.querySelector('#quant-select');
    if (quantSelect) {
      quantSelect.addEventListener('change', (e) => {
        this.quantization = e.target.value;
        this.render();
      });
    }

    const contextSelect = this.container.querySelector('#context-select');
    if (contextSelect) {
      contextSelect.addEventListener('change', (e) => {
        this.contextLength = parseInt(e.target.value, 10);
        this.render();
      });
    }

    const scaffoldBtn = this.container.querySelector('#btn-scaffold-agent');
    if (scaffoldBtn) {
      scaffoldBtn.addEventListener('click', () => {
        const name = this.container.querySelector('#new-agent-name')?.value || 'CustomSpecialist';
        const domain = this.container.querySelector('#new-agent-domain')?.value || 'Robotics';
        const perm = this.container.querySelector('#new-agent-perm')?.value || 'READ_ONLY';
        const evalMetric = this.container.querySelector('#new-agent-eval')?.value || 'Accuracy > 95%';

        const resultBox = this.container.querySelector('#scaffold-result-pre');
        if (resultBox) {
          resultBox.style.display = 'block';
          resultBox.innerHTML = `
            <h5>✅ Agent Profile Scaffolding Created</h5>
            <pre><code>{
  "agentName": "${name}",
  "domain": "${domain}",
  "permissionProfile": "${perm}",
  "evaluationMetric": "${evalMetric}",
  "dependencies": ["sub_knowledge_graph", "sub_scientific_math"],
  "auditLogging": true,
  "emergencyStopBound": true
}</code></pre>
          `;
        }
      });
    }
  }
}
