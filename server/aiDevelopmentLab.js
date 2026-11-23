/**
 * VISION AI — AI Development Laboratory Engine
 * Module 5: Standalone AI project generation, dataset inspection, RAG pipelines,
 * compute/memory/VRAM estimation, hallucination & reliability benchmarking, and sub-agent scaffolding.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { securityPermissionsInstance, WORKSPACE_ROOT } = require('./securityPermissions.js');

class AIDevelopmentLab {
  constructor() {
    this.workspaceRoot = WORKSPACE_ROOT;
    this.projectsDir = path.join(this.workspaceRoot, 'projects');
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }

    // Model Catalog with Hardware Requirements & Specifications
    this.modelCatalog = {
      'gemma-2-2b': {
        name: 'Gemma 2 (2B Parameters)',
        parameters: '2.6B',
        contextWindow: 8192,
        recommendedPrecision: '4-bit / 8-bit',
        minVramInferenceGb: 2.5,
        minVramLoRAGb: 6.0,
        provider: 'Google / Local GGUF',
        strengths: 'Lightweight on-device execution, microcontrollers / edge PC, rapid response'
      },
      'llama-3.1-8b': {
        name: 'Llama 3.1 (8B Parameters)',
        parameters: '8.0B',
        contextWindow: 131072,
        recommendedPrecision: '4-bit (GGUF) / 16-bit (bfloat16)',
        minVramInferenceGb: 6.0,
        minVramLoRAGb: 14.0,
        provider: 'Meta / Local vLLM',
        strengths: 'Exceptional instruction following, code generation, multilingual, large context'
      },
      'mistral-7b-instruct': {
        name: 'Mistral 7B Instruct v0.3',
        parameters: '7.3B',
        contextWindow: 32768,
        recommendedPrecision: '4-bit / 8-bit',
        minVramInferenceGb: 5.5,
        minVramLoRAGb: 12.0,
        provider: 'Mistral AI / Local',
        strengths: 'Concise tool calling, efficient reasoning, high speed'
      },
      'gpt-4o-mini': {
        name: 'GPT-4o Mini',
        parameters: 'Proprietary (~small multimodal)',
        contextWindow: 128000,
        minVramInferenceGb: 0, // Cloud API
        provider: 'OpenAI Cloud API',
        strengths: 'Zero local compute required, fast tool execution, cost effective'
      }
    };
  }

  // =========================================================================
  // 1. HARDWARE, VRAM & COMPUTE ESTIMATOR
  // =========================================================================

  estimateTrainingAndInferenceResources(options = {}) {
    const parameterCountB = Number(options.parameterCountB || 8.0); // in Billions (e.g. 8.0 for 8B)
    const contextLengthTokens = Number(options.contextLengthTokens || 4096);
    const batchSize = Number(options.batchSize || 4);
    const trainingType = options.trainingType || 'lora_qlora'; // 'inference', 'lora_qlora', 'full_finetuning'
    const quantization = options.quantization || '4bit'; // '4bit', '8bit', '16bit'

    // Weight memory calculation
    let bytesPerParam = 2.0; // 16-bit float
    if (quantization === '4bit') bytesPerParam = 0.5;
    else if (quantization === '8bit') bytesPerParam = 1.0;

    const weightsMemoryGb = (parameterCountB * 1e9 * bytesPerParam) / (1024 ** 3);

    // KV Cache for inference: 2 * num_layers * hidden_size * num_heads * context * bytes
    // Empirical approximation for typical transformer architecture
    const kvCacheGb = (2 * contextLengthTokens * batchSize * 4096 * 2) / (1024 ** 3);

    let totalVramRequiredGb = weightsMemoryGb + kvCacheGb + 1.0; // 1.0 GB overhead
    let computeCostUSD = 0;

    if (trainingType === 'lora_qlora') {
      // QLoRA requires frozen 4-bit weights + FP16 LoRA adapters + gradients + optimizer states
      const adapterMemoryGb = (parameterCountB * 0.02 * 1e9 * 4) / (1024 ** 3);
      const activationsGb = (batchSize * contextLengthTokens * 4096 * 4) / (1024 ** 3);
      totalVramRequiredGb = weightsMemoryGb + adapterMemoryGb + activationsGb + 2.0;

      // Cost estimation based on standard cloud GPU rental ($0.75/hr for RTX 4090 / A10G)
      const estimatedHours = (options.datasetTokensMillion || 10) * 0.4;
      computeCostUSD = estimatedHours * 0.85;
    } else if (trainingType === 'full_finetuning') {
      // Full fine-tuning requires 16-bit weights + gradients + 2x Adam states (16 bytes/param total)
      totalVramRequiredGb = (parameterCountB * 1e9 * 16) / (1024 ** 3) + 4.0;
      const estimatedHours = (options.datasetTokensMillion || 10) * 2.5;
      computeCostUSD = estimatedHours * 3.50; // A100 / H100 pricing
    }

    return {
      success: true,
      parametersBillions: parameterCountB,
      quantization,
      trainingType,
      contextLengthTokens,
      batchSize,
      weightsMemoryGb: parseFloat(weightsMemoryGb.toFixed(2)),
      estimatedTotalVramRequiredGb: parseFloat(totalVramRequiredGb.toFixed(2)),
      estimatedComputeCostUSD: parseFloat(computeCostUSD.toFixed(2)),
      recommendedHardware: totalVramRequiredGb <= 8.0
        ? 'Consumer GPU: RTX 3060 / 4060 (8GB - 12GB VRAM)'
        : (totalVramRequiredGb <= 16.0
          ? 'Mid-range GPU: RTX 4080 (16GB) or Apple M-series (18GB+ Unified Memory)'
          : (totalVramRequiredGb <= 24.0
            ? 'High-end Workstation: RTX 3090 / 4090 (24GB VRAM)'
            : 'Enterprise Data Center GPU: NVIDIA A100 (40GB/80GB) or H100'))
    };
  }

  // =========================================================================
  // 2. DATASET INSPECTION & EVALUATION
  // =========================================================================

  inspectDataset(datasetPathOrArray) {
    let samples = [];
    if (typeof datasetPathOrArray === 'string') {
      const resolved = securityPermissionsInstance.resolveSafePath(datasetPathOrArray);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Dataset file "${datasetPathOrArray}" does not exist.`);
      }
      const raw = fs.readFileSync(resolved, 'utf8');
      if (datasetPathOrArray.endsWith('.jsonl')) {
        samples = raw.trim().split(/\r?\n/).map(line => JSON.parse(line));
      } else {
        samples = JSON.parse(raw);
      }
    } else if (Array.isArray(datasetPathOrArray)) {
      samples = datasetPathOrArray;
    } else {
      throw new Error('Dataset must be a valid file path or array of samples.');
    }

    const totalSamples = samples.length;
    let validPairs = 0;
    let missingPromptCount = 0;
    let missingCompletionCount = 0;
    let totalPromptChars = 0;
    let totalCompletionChars = 0;

    for (const item of samples) {
      const prompt = item.prompt || item.input || item.question || (item.messages && item.messages.find(m => m.role === 'user')?.content);
      const completion = item.completion || item.output || item.answer || (item.messages && item.messages.find(m => m.role === 'assistant')?.content);

      if (!prompt) missingPromptCount++;
      if (!completion) missingCompletionCount++;

      if (prompt && completion) {
        validPairs++;
        totalPromptChars += String(prompt).length;
        totalCompletionChars += String(completion).length;
      }
    }

    const avgPromptLength = validPairs > 0 ? Math.round(totalPromptChars / validPairs) : 0;
    const avgCompletionLength = validPairs > 0 ? Math.round(totalCompletionChars / validPairs) : 0;

    return {
      success: true,
      totalSamples,
      validPairs,
      missingPromptCount,
      missingCompletionCount,
      dataQualityScorePercent: totalSamples > 0 ? Math.round((validPairs / totalSamples) * 100) : 0,
      averagePromptCharLength: avgPromptLength,
      averageCompletionCharLength: avgCompletionLength,
      estimatedTokenCount: Math.round((totalPromptChars + totalCompletionChars) / 4)
    };
  }

  // =========================================================================
  // 3. RETRIEVAL-AUGMENTED GENERATION (RAG) CHUNKER & VECTOR SEARCH
  // =========================================================================

  buildRAGIndex(textDocuments, chunkSize = 250, chunkOverlap = 50) {
    const chunks = [];

    textDocuments.forEach((doc, docIdx) => {
      const text = typeof doc === 'string' ? doc : doc.text;
      const title = doc.title || `Document_${docIdx + 1}`;
      const source = doc.source || 'Local Documentation';

      const words = text.split(/\s+/);
      let i = 0;
      let chunkIdx = 0;

      while (i < words.length) {
        const slice = words.slice(i, i + chunkSize).join(' ');
        if (slice.trim().length > 0) {
          chunks.push({
            id: `chunk_${docIdx}_${chunkIdx}`,
            docTitle: title,
            source,
            text: slice,
            wordCount: slice.split(/\s+/).length,
            // Term frequency representation for keyword search
            terms: this._extractTermFrequencies(slice)
          });
          chunkIdx++;
        }
        i += (chunkSize - chunkOverlap);
      }
    });

    return {
      totalChunks: chunks.length,
      chunks,
      query: (searchQuery, topK = 3) => this._queryRAGIndex(chunks, searchQuery, topK)
    };
  }

  _extractTermFrequencies(text) {
    const tf = {};
    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }
    return tf;
  }

  _queryRAGIndex(chunks, query, topK = 3) {
    const queryTerms = this._extractTermFrequencies(query);
    const scored = chunks.map(chunk => {
      let score = 0;
      for (const [term, weight] of Object.entries(queryTerms)) {
        if (chunk.terms[term]) {
          score += (chunk.terms[term] * weight);
        }
      }
      return { ...chunk, score };
    });

    return scored
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // =========================================================================
  // 4. STANDALONE AI AGENT PROJECT SCAFFOLDER
  // =========================================================================

  scaffoldAIAgentProject(options = {}) {
    const projectName = String(options.name || 'custom_ai_assistant').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const description = options.description || 'Specialized autonomous AI assistant project';
    const personality = options.personality || 'FOCUSED_RESEARCHER';
    const targetDir = path.join(this.projectsDir, projectName);

    if (fs.existsSync(targetDir)) {
      throw new Error(`Project directory "projects/${projectName}" already exists.`);
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'tools'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'config'), { recursive: true });

    // 1. package.json
    const packageJson = {
      name: `stark-ai-${projectName}`,
      version: '1.0.0',
      description,
      main: 'index.js',
      scripts: {
        test: 'node tests/test_agent.js',
        start: 'node index.js'
      },
      keywords: ['stark-ai', 'agent', projectName]
    };
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');

    // 2. agentConfig.json (Isolated Permissions & Limits)
    const agentConfig = {
      name: projectName,
      personality,
      description,
      permissions: {
        networkAllowed: true,
        fileSystemWriteAllowed: false, // Read-only by default for security
        maxTokensPerQuery: 2048,
        rateLimitPerMinute: 30
      },
      systemPrompt: `You are ${projectName}, an autonomous AI assistant created under the VISION AI architecture.\nYour objective: ${description}.\nOperate strictly within your designated tools and cite evidence for claims.`,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(targetDir, 'config', 'agentConfig.json'), JSON.stringify(agentConfig, null, 2), 'utf8');

    // 3. index.js (Agent Entrypoint)
    const indexJs = `/**
 * VISION AI Sub-Agent Entrypoint: ${projectName}
 */

const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'agentConfig.json'), 'utf8'));

class Agent {
  constructor() {
    this.name = config.name;
    this.permissions = config.permissions;
  }

  async processQuery(userInput) {
    if (!userInput || String(userInput).trim().length === 0) {
      throw new Error('User input cannot be empty.');
    }
    return {
      agent: this.name,
      reply: "Acknowledged: " + userInput,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { Agent, agentInstance: new Agent() };
`;
    fs.writeFileSync(path.join(targetDir, 'index.js'), indexJs, 'utf8');

    // 4. tests/test_agent.js (Automated Test Suite)
    const testJs = `/**
 * Unit Test Suite for ${projectName}
 */

const assert = require('assert');
const { Agent } = require('../index.js');

async function runTests() {
  console.log('Running test suite for: ${projectName}');
  const agent = new Agent();
  assert(agent, 'Agent should instantiate properly');
  
  const res = await agent.processQuery('Hello world');
  assert.strictEqual(res.agent, '${projectName}');
  assert(res.reply.includes('Hello world'));
  console.log('  [PASS]: Agent processes query and returns structured response');
}

runTests().then(() => {
  console.log('All tests passed.');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
`;
    fs.writeFileSync(path.join(targetDir, 'tests', 'test_agent.js'), testJs, 'utf8');

    // 5. README.md
    const readmeMd = `# ${projectName}\n\n${description}\n\n## Architecture\n- Isolated permissions defined in \`config/agentConfig.json\`\n- Standalone test suite executed via \`npm test\`\n`;
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeMd, 'utf8');

    return {
      success: true,
      projectName,
      projectPath: path.relative(this.workspaceRoot, targetDir),
      filesCreated: [
        'package.json',
        'config/agentConfig.json',
        'index.js',
        'tests/test_agent.js',
        'README.md'
      ],
      summary: `Standalone AI agent "${projectName}" successfully scaffolded with isolated permissions in projects/${projectName}.`
    };
  }
}

const aiDevelopmentLabInstance = new AIDevelopmentLab();

module.exports = {
  AIDevelopmentLab,
  aiDevelopmentLabInstance
};
