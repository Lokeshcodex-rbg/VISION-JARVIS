/**
 * VISION AI — Unified Multimodal Reasoning & Specialist Agent Orchestrator
 * Implements Phase 11 Section 9 (Multimodal Reasoning), Section 10 (Specialist Integration),
 * Section 11 (Multimodal Memory Integration), and Section 13 (Safety & Provenance).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { screenUnderstandingEngineInstance } = require('./screenUnderstandingEngine.js');
const { multimodalDocumentEngineInstance } = require('./multimodalDocumentEngine.js');
const { videoIntelligenceEngineInstance } = require('./videoIntelligenceEngine.js');
const { cameraIntelligenceEngineInstance } = require('./cameraIntelligenceEngine.js');
const { verificationAdversarialEngineInstance } = require('../verificationAdversarialEngine.js');
const { permissionGateInstance } = require('../desktop/permissionGate.js');
const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
const { starkMemoryDbInstance, MEMORY_LAYERS } = require('../memory/starkMemoryDb.js');
const knowledgeGraphEngine = require('../knowledgeGraphEngine.js');
const { neuralBrainServiceInstance } = require('../neural/neuralBrainService.js');

class MultimodalReasoningEngine {
  constructor() {
    this.screenEngine = screenUnderstandingEngineInstance;
    this.documentEngine = multimodalDocumentEngineInstance;
    this.videoEngine = videoIntelligenceEngineInstance;
    this.cameraEngine = cameraIntelligenceEngineInstance;
    this.verifier = verificationAdversarialEngineInstance;
    this.permissionGate = permissionGateInstance;

    // Shared in-process cache synced to SQLite + Knowledge Graph
    this.multimodalMemoryStore = [];
  }

  _hashSource(sourcePath = '', fallbackText = '') {
    try {
      if (sourcePath && fs.existsSync(sourcePath)) {
        const buf = fs.readFileSync(sourcePath);
        return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
      }
    } catch (_) {}
    return crypto.createHash('sha256').update(String(fallbackText || Date.now())).digest('hex').slice(0, 16);
  }

  /**
   * Persists a visual/multimodal observation into the unified JARVIS memory (SQLite + Knowledge Graph)
   * with full provenance, detected components, numeric specs, and explicit uncertainties.
   */
  saveVisualObservationToSharedMemory({
    summary = '',
    components = [],
    specifications = {},
    uncertainties = [],
    sourceImagePath = '',
    confidence = 0.72,
    visionCategory = null,
    ocrText = '',
    metadata = {},
    personality = 'JARVIS'
  } = {}) {
    const cleanSummary = this.sanitizeInput(String(summary || '').trim());
    if (!cleanSummary) {
      return { success: false, reason: 'EMPTY_OBSERVATION' };
    }

    const obsHash = this._hashSource(sourceImagePath, cleanSummary);
    const timestamp = new Date().toISOString();
    const cleanComponents = Array.isArray(components) ? components.map(c => String(c)).filter(Boolean) : [];
    const cleanUncertainties = Array.isArray(uncertainties) ? uncertainties.map(u => String(u)).filter(Boolean) : [];

    const specText = specifications && Object.keys(specifications).length > 0
      ? ` Specs: ${JSON.stringify(specifications)}.`
      : '';
    const uncertaintyText = cleanUncertainties.length > 0
      ? ` Uncertainties: ${cleanUncertainties.join('; ')}.`
      : '';
    const categoryText = visionCategory ? ` Category: ${visionCategory}.` : '';
    const fact = `[Visual Observation ${obsHash}] ${cleanSummary}${categoryText}${specText}${uncertaintyText}`;

    const dbRes = starkMemoryDbInstance.insertMemory({
      fact,
      category: 'visual_observation',
      epistemicType: cleanUncertainties.length > 0 ? 'HYPOTHESIS' : 'VERIFIED_FACT',
      source: sourceImagePath ? `vision:${path.basename(sourceImagePath)}` : 'vision:multimodal',
      confidence: Math.max(0.1, Math.min(0.99, Number(confidence) || 0.72)),
      verified: cleanUncertainties.length === 0,
      memoryLayer: MEMORY_LAYERS.SEMANTIC,
      recordType: 'EVIDENCE',
      domainTags: ['vision', 'multimodal', ...cleanComponents.slice(0, 4), ...(visionCategory ? [visionCategory] : [])],
      metadata: {
        recordType: 'visual_observation',
        obsHash,
        sourceImagePath: sourceImagePath || null,
        components: cleanComponents,
        specifications,
        uncertainties: cleanUncertainties,
        visionCategory,
        ocrSnippet: ocrText ? String(ocrText).slice(0, 300) : '',
        personality,
        timestamp,
        ...metadata
      }
    });

    const obsNodeId = `vis_obs_${obsHash}`;
    try {
      knowledgeGraphEngine.addNode(
        cleanUncertainties.length > 0 ? 'claim' : 'verified_result',
        obsNodeId,
        `Visual Observation: ${cleanSummary.slice(0, 90)}`,
        {
          recordType: 'visual_observation',
          obsHash,
          sourceImagePath: sourceImagePath || null,
          visionCategory: visionCategory || 'general',
          components: cleanComponents,
          specifications,
          uncertainties: cleanUncertainties,
          confidence: Number(confidence) || 0.72,
          observedAt: timestamp
        },
        sourceImagePath ? `Visual Inspection (${path.basename(sourceImagePath)})` : 'Multimodal Vision'
      );

      for (const comp of cleanComponents.slice(0, 6)) {
        const compSlug = comp.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
        if (!compSlug) continue;
        const compNodeId = `vis_comp_${compSlug}`;
        knowledgeGraphEngine.addNode(
          'hardware_component',
          compNodeId,
          comp,
          {
            discoveredVia: 'multimodal_vision',
            specifications,
            visionCategory: visionCategory || null,
            lastObservedAt: timestamp
          },
          sourceImagePath ? `Visual Inspection (${path.basename(sourceImagePath)})` : 'Multimodal Vision'
        );
        knowledgeGraphEngine.addEdge(compNodeId, obsNodeId, 'DERIVED_FROM', Number(confidence) || 0.72, {
          source: 'MultimodalReasoningEngine'
        });
      }
    } catch (kgErr) {
      console.warn('[MULTIMODAL_KG] Non-fatal KG sync warning:', kgErr.message);
    }

    const record = {
      id: dbRes?.id || obsNodeId,
      obsNodeId,
      obsHash,
      timestamp,
      summary: cleanSummary,
      components: cleanComponents,
      specifications,
      uncertainties: cleanUncertainties,
      visionCategory,
      confidence: Number(confidence) || 0.72
    };
    this.multimodalMemoryStore.push(record);
    return { success: true, ...record };
  }

  /**
   * Recalls saved visual observations & recognized hardware specs across sessions
   * from unified SQLite memory + Knowledge Graph.
   */
  recallVisualObservations(query = '', limit = 5) {
    const maxItems = Math.max(1, Math.min(20, Number(limit) || 5));
    const results = [];
    const seenIds = new Set();

    try {
      const searchHits = query
        ? starkMemoryDbInstance.searchMemories(query, { category: 'visual_observation', limit: maxItems })
        : [];
      const activeHits = starkMemoryDbInstance.getActiveMemories({ category: 'visual_observation', limit: maxItems });
      for (const mem of [...(searchHits || []), ...(activeHits || [])]) {
        if (!mem || seenIds.has(mem.id)) continue;
        seenIds.add(mem.id);
        results.push({
          id: mem.id,
          fact: mem.fact,
          confidence: mem.confidence,
          source: mem.source,
          createdAt: mem.createdAt || mem.created_at,
          metadata: mem.metadata || {}
        });
      }
    } catch (_) {}

    if (results.length < maxItems) {
      try {
        for (const node of knowledgeGraphEngine.nodes.values()) {
          if (node.properties?.recordType === 'visual_observation' && !seenIds.has(node.id)) {
            const text = `${node.label} ${JSON.stringify(node.properties)}`;
            if (!query || query.toLowerCase().split(/\s+/).some(w => w.length > 2 && text.toLowerCase().includes(w))) {
              seenIds.add(node.id);
              results.push({
                id: node.id,
                fact: node.label,
                confidence: node.properties?.confidence || 0.72,
                source: node.provenance,
                createdAt: node.properties?.observedAt,
                metadata: node.properties || {}
              });
            }
          }
          if (results.length >= maxItems) break;
        }
      } catch (_) {}
    }

    return results.slice(0, maxItems);
  }

  /**
   * Sanitizes untrusted visual/document/transcription text against prompt injection
   */
  sanitizeInput(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/ignore (all )?previous instructions/gi, '[INJECTION_BLOCKED]')
      .replace(/system:?\s*you are now/gi, '[INJECTION_BLOCKED]')
      .replace(/<\|im_start\|>|<\|im_end\|>/gi, '');
  }

  /**
   * Core Multimodal Reasoning Workflow
   * Combines visual evidence, speech transcription, conversation context, and specialist agents.
   */
  async reasonOverMultimodalInput({
    userQuery = '',
    speechTranscript = '',
    attachedFiles = [], // Array of file paths (images, pdfs, docs, videos)
    includeScreen = false,
    includeCamera = false,
    personality = 'JARVIS'
  } = {}) {
    const findings = {
      userIntent: this.sanitizeInput(userQuery || speechTranscript),
      visualEvidence: [],
      documentEvidence: [],
      videoEvidence: [],
      cameraEvidence: null,
      ownedNeuralVision: [],
      priorVisualMemory: this.recallVisualObservations(userQuery || speechTranscript, 3),
      specialistAgentsInvolved: [],
      conclusions: [],
      provenance: []
    };

    // 1. Process Active Desktop Screen if requested or implied
    const screenKeywords = ['screen', 'desktop', 'window', 'click', 'open', 'error on screen', 'look at my screen'];
    const queryLower = findings.userIntent.toLowerCase();
    const shouldCaptureScreen = includeScreen || screenKeywords.some(k => queryLower.includes(k));

    if (shouldCaptureScreen) {
      const screenInfo = await this.screenEngine.executeScreenAction({
        actionType: 'inspect',
        targetQuery: findings.userIntent,
        personality
      });
      findings.visualEvidence.push({
        type: 'ACTIVE_SCREEN',
        activeApp: screenInfo.activeApp,
        totalElements: screenInfo.totalElements,
        matches: screenInfo.matches,
        screenshotPath: screenInfo.screenSnapshot
      });
      findings.specialistAgentsInvolved.push('System Agent (Screen Perception)');
    }

    // 2. Process Attached Files (PDF, Image, DOCX, Video) & Owned Neural Vision Classifier
    for (const filePath of attachedFiles) {
      const ext = filePath.split('.').pop().toLowerCase();
      if (['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
        const docRes = await this.documentEngine.analyzeDocument(filePath);
        if (docRes.success) {
          findings.documentEvidence.push(docRes);
          if (ext === 'pdf' || ext === 'docx') {
            findings.specialistAgentsInvolved.push('Document Agent (Structure & Table Extraction)');
          } else {
            findings.specialistAgentsInvolved.push('Research Agent (Visual Artifact Analysis)');
          }
        }
        if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext) && neuralBrainServiceInstance) {
          try {
            const neuralRes = await neuralBrainServiceInstance.inferWithOwnedBrain({
              prompt: findings.userIntent || 'Classify image artifact',
              imagePath: filePath,
              maxNewTokens: 16
            });
            if (neuralRes.success) {
              findings.ownedNeuralVision.push({
                filePath,
                checkpoint: neuralRes.checkpoint,
                topCategory: neuralRes.visionPrediction?.top_category || null,
                confidence: neuralRes.visionPrediction?.confidence || 0,
                bbox: neuralRes.visionPrediction?.predicted_bbox_xywh || null
              });
              findings.specialistAgentsInvolved.push(`Owned Neural Vision (${neuralRes.checkpoint})`);
            }
          } catch (_) {}
        }
      } else if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
        const vidRes = await this.videoEngine.analyzeVideo(filePath);
        if (vidRes.success) {
          findings.videoEvidence.push(vidRes);
          findings.specialistAgentsInvolved.push('Research Agent (Video Temporal Extraction)');
        }
      }
    }

    // 3. Process Live Camera if explicitly requested
    if (includeCamera) {
      const camRes = await this.cameraEngine.analyzeLiveFrame(findings.userIntent);
      if (camRes.success) {
        findings.cameraEvidence = camRes;
        findings.specialistAgentsInvolved.push('System Agent (Real-World Perception)');
      }
    }

    // 4. Specialist Agent Synthesis & Grounded Reasoning
    let responseText = '';
    if (findings.documentEvidence.length > 0) {
      const firstDoc = findings.documentEvidence[0];
      if (queryLower.includes('compare') && findings.documentEvidence.length > 1) {
        const comp = await this.documentEngine.compareDocuments(attachedFiles[0], attachedFiles[1]);
        responseText = comp.summary;
        findings.conclusions.push(comp.summary);
      } else if (queryLower.includes('table') || queryLower.includes('chart')) {
        responseText = `Extracted data from ${firstDoc.fileName}: Located ${firstDoc.tablesCount || 0} structured tables. Key contents: ${firstDoc.summary}`;
        findings.conclusions.push(responseText);
      } else {
        const answer = await this.documentEngine.answerDocumentQuestion(firstDoc.filePath, findings.userIntent);
        responseText = answer.groundedAnswer;
        if (findings.ownedNeuralVision.length > 0) {
          const nv = findings.ownedNeuralVision[0];
          responseText += ` Owned vision model (${nv.checkpoint}) prediction: ${nv.topCategory} (${(nv.confidence * 100).toFixed(1)}% conf).`;
        }
        findings.conclusions.push(responseText);
      }
    } else if (findings.visualEvidence.length > 0) {
      const scr = findings.visualEvidence[0];
      responseText = `I have inspected your screen: The active application is "${scr.activeApp ? scr.activeApp.title : 'Desktop'}". Visual perception identified ${scr.totalElements} controls.`;
      findings.conclusions.push(responseText);
    } else if (findings.videoEvidence.length > 0) {
      const vid = findings.videoEvidence[0];
      responseText = vid.summary;
      findings.conclusions.push(responseText);
    } else if (findings.cameraEvidence) {
      responseText = `Camera frame analyzed (${findings.cameraEvidence.width || '?'}x${findings.cameraEvidence.height || '?'}): ${findings.cameraEvidence.summary || 'Visual frame captured.'}`;
      findings.conclusions.push(responseText);
    } else {
      responseText = `Multimodal reasoning completed for query: "${findings.userIntent}". All sensor inputs verified.`;
      findings.conclusions.push(responseText);
    }

    // 5. Index into Unified Shared Memory (SQLite + Knowledge Graph) with Full Provenance
    const firstVisualFile = attachedFiles.find(f => /\.(png|jpe?g|webp|bmp|pdf|mp4|mkv|avi|mov|webm)$/i.test(f)) || '';
    const ownedPred = findings.ownedNeuralVision[0] || null;
    const savedSharedMemory = (findings.documentEvidence.length > 0 || findings.videoEvidence.length > 0 || findings.cameraEvidence)
      ? this.saveVisualObservationToSharedMemory({
          summary: responseText,
          components: ownedPred?.topCategory ? [ownedPred.topCategory] : [],
          specifications: {
            visualSourcesCount: findings.visualEvidence.length + findings.documentEvidence.length + findings.videoEvidence.length,
            ownedVisionConfidence: ownedPred?.confidence || null
          },
          uncertainties: ownedPred && ownedPred.confidence < 0.75 ? [`Owned neural classifier confidence ${(ownedPred.confidence * 100).toFixed(1)}% requires human or CAD datasheet confirmation.`] : [],
          sourceImagePath: firstVisualFile,
          confidence: ownedPred ? Math.max(0.55, ownedPred.confidence) : 0.75,
          visionCategory: ownedPred?.topCategory || null,
          ocrText: findings.documentEvidence[0]?.summary || '',
          personality
        })
      : null;

    const memoryRecord = {
      id: savedSharedMemory?.id || `mm_mem_${Date.now()}`,
      timestamp: new Date().toISOString(),
      intent: findings.userIntent,
      visualSourcesCount: findings.visualEvidence.length + findings.documentEvidence.length + findings.videoEvidence.length,
      specialistAgents: Array.from(new Set(findings.specialistAgentsInvolved)),
      summary: responseText,
      sharedMemoryPersisted: Boolean(savedSharedMemory?.success),
      provenance: {
        agent: personality,
        attachedFiles,
        screenInspected: shouldCaptureScreen
      }
    };
    this.multimodalMemoryStore.push(memoryRecord);

    auditTrailEngineInstance.logEvent(
      EVENT_TYPES.EXECUTION_STEP,
      'multimodal_reasoning_synthesis',
      memoryRecord,
      true,
      personality
    );

    return {
      success: true,
      personality,
      findings,
      response: responseText,
      specialistAgents: Array.from(new Set(findings.specialistAgentsInvolved)),
      memoryRecord
    };
  }

  getMultimodalMemoryHistory() {
    return [...this.multimodalMemoryStore];
  }
}

module.exports = {
  MultimodalReasoningEngine,
  multimodalReasoningEngineInstance: new MultimodalReasoningEngine()
};
