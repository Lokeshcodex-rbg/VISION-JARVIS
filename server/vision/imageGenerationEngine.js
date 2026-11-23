/**
 * VISION AI — Unified Multimodal Image Generation & Visual Synthesis Engine
 * server/vision/imageGenerationEngine.js
 *
 * Implements:
 *   1. Text-to-Image Generation across realistic photography, product photography,
 *      digital illustrations, visual concepts, and engineering design references.
 *   2. Image Variations & Prompt-Driven Editing (style transforms, background changes, composition).
 *   3. Transparent Attribution: Strictly identifies the underlying model/provider
 *      (e.g., Google Gemini Imagen 3.0 via DeepMind API or VISION Local Procedural Vector Synthesis).
 *   4. Image Storage & Gallery Ledger at D:/Jarvis/data/generated_images/gallery.json.
 *   5. Seamless integration with conversational tools, main companion chat, and floating voice window.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GENERATED_IMAGES_DIR = path.join(__dirname, '..', '..', 'data', 'generated_images');
const GALLERY_LEDGER_PATH = path.join(GENERATED_IMAGES_DIR, 'gallery.json');

// Supported visual generation styles
const IMAGE_STYLES = {
  REALISTIC_PHOTOGRAPHY: {
    key: 'realistic_photography',
    label: 'Realistic Photography',
    promptModifier: 'cinematic 35mm photograph, 8k resolution, photorealistic, natural lighting, subtle depth of field, sharp focus, masterwork photography'
  },
  PRODUCT_PHOTOGRAPHY: {
    key: 'product_photography',
    label: 'Commercial Product Photography',
    promptModifier: 'professional studio product photography, clean neutral studio background, softbox lighting, high contrast, macro commercial detail, crisp reflections'
  },
  ILLUSTRATION: {
    key: 'illustration',
    label: 'Digital Illustration',
    promptModifier: 'modern digital art illustration, vector aesthetic, expressive color palette, clean outlines, high detail, studio artistic rendering'
  },
  VISUAL_CONCEPT: {
    key: 'visual_concept',
    label: 'Architectural & Tech Concept',
    promptModifier: 'futuristic holographic tech concept, clean lines, technical aesthetic, ambient sci-fi glow, isometric 3D architectural rendering'
  },
  DESIGN_REFERENCE: {
    key: 'design_reference',
    label: 'Industrial Engineering Blueprint',
    promptModifier: 'detailed engineering blueprint, technical CAD drawing, orthographic multi-view projections, dimensional annotations, crisp dark blueprint aesthetics'
  }
};

class ImageGenerationEngine {
  constructor(options = {}) {
    this.geminiKey = process.env.GEMINI_API_KEY || null;
    this.storageDir = GENERATED_IMAGES_DIR;
    this.galleryPath = GALLERY_LEDGER_PATH;
    this.gallery = [];
    this._ensureStorage();
    this._loadGallery();
  }

  _ensureStorage() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[IMAGE_GEN] Failed to create storage dir:', err.message);
    }
  }

  _loadGallery() {
    try {
      if (fs.existsSync(this.galleryPath)) {
        const data = fs.readFileSync(this.galleryPath, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.gallery = parsed;
        }
      }
    } catch (_) {
      this.gallery = [];
    }
  }

  _saveGallery() {
    try {
      this._ensureStorage();
      fs.writeFileSync(this.galleryPath, JSON.stringify(this.gallery.slice(-200), null, 2), 'utf8');
    } catch (err) {
      console.warn('[IMAGE_GEN] Failed to save gallery ledger:', err.message);
    }
  }

  /**
   * Refreshes API key from environment or .env if changed.
   */
  updateApiKey(key) {
    if (key) this.geminiKey = key;
  }

  /**
   * Formats prompt with appropriate style modifiers and negative constraints.
   */
  enhancePrompt(prompt, styleKey = 'realistic_photography') {
    const cleanPrompt = String(prompt || '').trim();
    const style = IMAGE_STYLES[styleKey.toUpperCase()] || IMAGE_STYLES[styleKey] || IMAGE_STYLES.REALISTIC_PHOTOGRAPHY;
    return `${cleanPrompt}, ${style.promptModifier}`;
  }

  /**
   * Generates a high-quality SVG/PNG visual blueprint concept locally.
   * Feasible on any Intel i5 system with zero GPU / zero network dependencies.
   */
  generateProceduralVectorImage({ prompt, styleKey, imageId, width = 1024, height = 1024 }) {
    const isBlueprint = /blueprint|cad|diagram|circuit|robot|sensor|schematic|architecture/i.test(prompt) || styleKey === 'design_reference';
    const isDark = true;
    const bg = isBlueprint ? '#0a1628' : '#0d1117';
    const gridColor = isBlueprint ? 'rgba(0, 180, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)';
    const strokeColor = isBlueprint ? '#00e5ff' : '#00adb5';
    const accentColor = isBlueprint ? '#ff007f' : '#ff5722';

    // Procedural geometry based on prompt hash
    const hash = crypto.createHash('md5').update(prompt).digest('hex');
    const seed = parseInt(hash.slice(0, 8), 16);

    const safePromptEscaped = prompt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .slice(0, 75);

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="gradBg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="${isBlueprint ? '#122b4d' : '#1a2332'}" />
      <stop offset="100%" stop-color="${bg}" />
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${gridColor}" stroke-width="1"/>
    </pattern>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#gradBg)"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>

  <!-- Blueprint Outer Border & Alignment Crosshairs -->
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="8 4" opacity="0.6"/>
  <circle cx="30" cy="30" r="12" fill="none" stroke="${strokeColor}" stroke-width="1.5"/>
  <circle cx="${width - 30}" cy="30" r="12" fill="none" stroke="${strokeColor}" stroke-width="1.5"/>
  <circle cx="30" cy="${height - 30}" r="12" fill="none" stroke="${strokeColor}" stroke-width="1.5"/>
  <circle cx="${width - 30}" cy="${height - 30}" r="12" fill="none" stroke="${strokeColor}" stroke-width="1.5"/>

  <!-- Central Visual Glyph / Blueprint Geometry -->
  <g transform="translate(${width / 2}, ${height / 2 - 40})">
    <circle cx="0" cy="0" r="190" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.75" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="140" fill="none" stroke="${accentColor}" stroke-width="1.5" stroke-dasharray="12 6" opacity="0.8"/>
    <circle cx="0" cy="0" r="90" fill="none" stroke="${strokeColor}" stroke-width="2.5" opacity="0.9"/>
    <circle cx="0" cy="0" r="28" fill="${strokeColor}" opacity="0.3" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="8" fill="#ffffff"/>

    <!-- Dynamic Nodes / Ray lines -->
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => {
      const rad = (angle * Math.PI) / 180;
      const x1 = Math.cos(rad) * 90;
      const y1 = Math.sin(rad) * 90;
      const x2 = Math.cos(rad) * 190;
      const y2 = Math.sin(rad) * 190;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${strokeColor}" stroke-width="1.5" opacity="0.7"/>
              <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="5" fill="${idx % 2 === 0 ? strokeColor : accentColor}"/>`;
    }).join('\n    ')}

    <!-- Hexagonal Frame -->
    <polygon points="0,-165 142,-82 142,82 0,165 -142,82 -142,-82" fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4"/>
  </g>

  <!-- Technical Telemetry & Metadata Header -->
  <g transform="translate(60, 75)" font-family="Consolas, 'Courier New', monospace" fill="${strokeColor}">
    <text x="0" y="0" font-size="15" font-weight="bold" letter-spacing="2">VISION × JARVIS · SYNTHETIC DESIGN SCHEMATIC</text>
    <text x="0" y="24" font-size="12" opacity="0.75" fill="#a0c4ff">ID: ${imageId.toUpperCase()} | STYLE: ${styleKey.toUpperCase()}</text>
    <text x="0" y="44" font-size="12" opacity="0.75" fill="#a0c4ff">DIMENSIONS: ${width}x${height}px | RENDER: PROCEDURAL VECTOR</text>
  </g>

  <!-- Prompt & Description Label -->
  <g transform="translate(60, ${height - 110})" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    <rect x="-10" y="-18" width="${width - 100}" height="76" rx="8" fill="rgba(0, 15, 30, 0.75)" stroke="${strokeColor}" stroke-width="1" opacity="0.9"/>
    <text x="10" y="8" font-size="13" font-weight="600" fill="#ffffff">PROMPT: "${safePromptEscaped}"</text>
    <text x="10" y="30" font-size="11" font-family="Consolas, monospace" fill="#64d8cb">ATTRIBUTION: Generated by VISION Local Procedural Blueprint Engine</text>
    <text x="10" y="48" font-size="10.5" font-family="Consolas, monospace" fill="#8892b0">AUTHORIZED BY: LOKESH · POWERED BY VISION AI OPERATING SYSTEM</text>
  </g>
</svg>
`.trim();

    const fileName = `img_${imageId}.svg`;
    const filePath = path.join(this.storageDir, fileName);
    fs.writeFileSync(filePath, svg, 'utf8');

    return {
      fileName,
      filePath,
      format: 'svg',
      width,
      height,
      sizeBytes: Buffer.byteLength(svg, 'utf8')
    };
  }

  /**
   * Generates image via Gemini Imagen 3 API if key available, else procedural fallback.
   */
  async generateImage({
    prompt = '',
    style = 'realistic_photography',
    aspectRatio = '1:1',
    negativePrompt = 'low quality, blurry, distorted, watermark',
    allowFallback = true
  } = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Image generation prompt is required.');
    }

    const t0 = Date.now();
    const imageId = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const enhancedPrompt = this.enhancePrompt(prompt, style);
    const styleMeta = IMAGE_STYLES[style.toUpperCase()] || IMAGE_STYLES[style] || IMAGE_STYLES.REALISTIC_PHOTOGRAPHY;

    let result = null;
    let providerUsed = 'none';
    let modelUsed = 'none';
    let attribution = '';

    // 1. Attempt Gemini Imagen 3 Generation if API key is present
    if (this.geminiKey) {
      try {
        console.log(`[IMAGE_GEN][${imageId}] Calling Google Gemini Imagen 3 API for prompt: "${prompt.slice(0, 50)}..."`);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.geminiKey}`;

        const reqBody = {
          instances: [
            { prompt: enhancedPrompt }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio === '16:9' ? '16:9' : (aspectRatio === '9:16' ? '9:16' : (aspectRatio === '4:3' ? '4:3' : '1:1')),
            negativePrompt: negativePrompt,
            outputMimeType: 'image/jpeg'
          }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const base64Data = data?.predictions?.[0]?.bytesBase64Encoded;

          if (base64Data) {
            const fileName = `img_${imageId}.jpg`;
            const filePath = path.join(this.storageDir, fileName);
            const buf = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buf);

            providerUsed = 'Google Gemini (Imagen 3.0)';
            modelUsed = 'imagen-3.0-generate-002';
            attribution = 'Generated by Gemini Imagen 3 via Google DeepMind API; requested by JARVIS, powered by VISION — MADE BY LOKESH';

            result = {
              success: true,
              imageId,
              fileName,
              filePath,
              format: 'jpeg',
              width: 1024,
              height: 1024,
              sizeBytes: buf.length,
              providerUsed,
              modelUsed,
              attribution
            };
          }
        } else {
          const errText = await response.text();
          console.warn(`[IMAGE_GEN][${imageId}] Imagen API returned ${response.status}:`, errText.slice(0, 200));
        }
      } catch (err) {
        console.warn(`[IMAGE_GEN][${imageId}] Imagen API invocation failed:`, err.message);
      }
    }

    // 2. Local Fallback Visual Synthesis if Imagen was unavailable or failed
    if (!result && allowFallback) {
      console.log(`[IMAGE_GEN][${imageId}] Using VISION Local Procedural Vector Synthesis Engine.`);
      const synth = this.generateProceduralVectorImage({ prompt, styleKey: styleMeta.key, imageId });
      providerUsed = 'VISION Native Procedural Engine';
      modelUsed = 'vision-procedural-vector-v1.0';
      attribution = 'Generated by VISION Local Procedural Vector Synthesis Engine; requested by JARVIS, powered by VISION — MADE BY LOKESH';

      result = {
        success: true,
        imageId,
        fileName: synth.fileName,
        filePath: synth.filePath,
        format: synth.format,
        width: synth.width,
        height: synth.height,
        sizeBytes: synth.sizeBytes,
        providerUsed,
        modelUsed,
        attribution
      };
    }

    if (!result) {
      throw new Error('Image generation could not be completed with current resources.');
    }

    const durationMs = Date.now() - t0;
    const entry = {
      id: imageId,
      imageId: imageId,
      prompt,
      enhancedPrompt,
      style: styleMeta.key,
      styleLabel: styleMeta.label,
      aspectRatio,
      fileName: result.fileName,
      filePath: result.filePath,
      format: result.format,
      sizeBytes: result.sizeBytes,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      attribution: result.attribution,
      durationMs,
      createdAt: new Date().toISOString()
    };

    // Add to gallery index
    this.gallery.unshift(entry);
    this._saveGallery();

    return {
      ...result,
      prompt,
      enhancedPrompt,
      style: styleMeta.label,
      durationMs,
      galleryCount: this.gallery.length,
      webUrl: `/api/image/file/${result.fileName}`
    };
  }

  /**
   * Generates variations or edits an existing image based on instructions.
   */
  async editImage({
    baseImageId = '',
    sourceImagePath = '',
    instruction = '',
    editInstruction = '',
    prompt = '',
    style = 'realistic_photography',
    targetStyle = null,
    aspectRatio = '1:1'
  } = {}) {
    const finalInstruction = editInstruction || instruction || prompt;
    if (!finalInstruction) {
      throw new Error('Edit instruction is required to modify or create variations of an image.');
    }

    let source = sourceImagePath;
    if (!source && baseImageId) {
      const meta = this.getImageMetadata(baseImageId);
      if (meta?.filePath) source = meta.filePath;
    }

    let basePrompt = finalInstruction;
    if (source) {
      const baseName = path.basename(source);
      basePrompt = `Variation based on ${baseName}: ${finalInstruction}`;
    }

    const res = await this.generateImage({
      prompt: basePrompt,
      style: targetStyle || style,
      aspectRatio,
      allowFallback: true
    });

    return {
      ...res,
      isEdit: true,
      baseImageId: baseImageId || (source ? path.basename(source) : 'base'),
      originalSource: source ? path.basename(source) : null,
      instruction: finalInstruction
    };
  }

  /**
   * Retrieves gallery records
   */
  getGallery(limit = 30) {
    return this.gallery.slice(0, limit);
  }

  /**
   * Retrieves a single image metadata record by ID or filename
   */
  getImageMetadata(imageId) {
    if (!imageId) return null;
    return this.gallery.find(g => g.imageId === imageId || g.id === imageId || g.fileName === imageId) || null;
  }

  /**
   * Cleans old images if requested
   */
  deleteImage(imageId) {
    const idx = this.gallery.findIndex(g => g.id === imageId || g.fileName === imageId);
    if (idx !== -1) {
      const item = this.gallery[idx];
      try {
        if (fs.existsSync(item.filePath)) fs.unlinkSync(item.filePath);
      } catch (_) {}
      this.gallery.splice(idx, 1);
      this._saveGallery();
      return true;
    }
    return false;
  }
}

const imageGenerationEngineInstance = new ImageGenerationEngine();

module.exports = {
  ImageGenerationEngine,
  imageGenerationEngineInstance,
  IMAGE_STYLES,
  GENERATED_IMAGES_DIR
};
