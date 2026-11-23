/**
 * JARVIS — Living Code Sclera Field Generator & Flow Renderer
 * Constructs the entire eye surface out of thousands of curved programming code fragments.
 */

import { CONFIG } from '../config.js';
import { clamp, smoothstep, randomRange, randomChoice } from '../math/utils.js';

// Extensive realistic programming tokens, binary sequences, hex values, and system instructions
const CODE_VOCABULARY = [
  'async function* neuralStream()', 'ptr->weights.compute_simd();', '0x7FFF80C2A0',
  'volatile uint32_t reg = 0xDEADBEEF;', 'const [gaze, setGaze] = useTensor();',
  'mat4x4_perspective(proj, fov, aspect);', '__m256 f = _mm256_load_ps(&vec[i]);',
  'fn eye_occlusion_mask(&mut self, dt: f64)', 'while (stream.has_pending_quanta())',
  '0b110100101100101011000101', 'tensor.backward(gradient);',
  'kernel_exec<<<grid, threads>>>(d_retina);', 'quaternion_slerp(&q0, &q1, alpha);',
  '0xCAFEBABE', '0x00401000', 'std::memory_order_relaxed', 'canvas.clip(path2d);',
  'iris.fibers.forEach(f => f.render());', 'const delta = performance.now() - t0;',
  'if (retina.is_occluded) { trigger_saccade(); }', '01001010 01000001 01010010',
  'float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));', '0x8048000',
  'typedef struct OcularNode { uint64_t id; float weight; }',
  'export default class JarvisOcularEngine', 'await device.queue.submit([encoder.finish()]);',
  '__kernel void process_pupil(__global float* buf)', '0b0010101101001111',
  'vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));', 'simd_fma_f32(a, b, c);',
  'const ocular_entropy = Math.sin(t * 0.05);', '0xFF00AA55', '0xDEAD10CC',
  'auto iris_trabecular = std::make_unique<TrabecularMesh>();',
  'void* const mmap_ptr = ::mmap(NULL, 0x10000, PROT_READ, MAP_ANON, -1, 0);',
  'uint16_t checksum = crc16_ccitt(stream_buffer, payload_len);',
  'const [corneal_depth, setRefraction] = useOcularState(0.9984);',
  '01101001 01110010 01101001 01110011 01011111 01100011 01101111 01100100 01100101'
];

const GLYPH_POOL = '0101010123456789ABCDEFabcdef{}[]<>()/*+=~;:!$_-&|^%#@?';

export class CodeField {
  constructor() {
    this.rows = [];
    this.totalCharacters = 0;
    this.isInitialized = false;
  }

  /**
   * Initializes continuous code token rows
   */
  initRows(rowCount = CONFIG.codeField.rowCount) {
    this.rows = [];
    this.totalCharacters = 0;

    for (let r = 0; r < rowCount; r++) {
      let lineText = '';
      while (lineText.length < 480) {
        lineText += randomChoice(CODE_VOCABULARY) + '   ';
      }

      const characters = [];
      for (let c = 0; c < lineText.length; c++) {
        const char = lineText[c];
        
        let colorType = 'silver';
        if ('0123456789ABCDEFabcdefx'.includes(char) && lineText.slice(Math.max(0, c - 2), c + 4).includes('0x')) {
          colorType = 'blue';
        } else if ('{}[]()<>;:,='.includes(char)) {
          colorType = 'slate';
        } else if (Math.random() < 0.18) {
          colorType = 'bright';
        } else if (Math.random() < 0.08) {
          colorType = 'violet';
        }

        characters.push({
          char: char,
          originalChar: char,
          colorType: colorType,
          baseAlpha: randomRange(0.58, 0.98),
          isGlitch: false
        });
        this.totalCharacters++;
      }

      const driftSpeed = CONFIG.codeField.baseDriftSpeed * randomRange(0.85, 1.15) * (r % 2 === 0 ? 1 : 0.92);

      this.rows.push({
        rowIndex: r,
        driftOffset: randomRange(0, 1000),
        driftSpeed: driftSpeed,
        characters: characters
      });
    }

    this.isInitialized = true;
  }

  /**
   * Updates row drift and living character scintillation
   */
  update(dtSec) {
    if (!this.isInitialized) return;

    for (let r = 0; r < this.rows.length; r++) {
      const row = this.rows[r];
      row.driftOffset += row.driftSpeed * dtSec;

      // Scintillation / micro-mutation (0.4% chance per frame)
      for (let c = 0; c < row.characters.length; c++) {
        const node = row.characters[c];
        if (Math.random() < 0.004) {
          node.char = randomChoice(GLYPH_POOL);
          node.isGlitch = true;
        } else if (node.isGlitch && Math.random() < 0.09) {
          node.char = node.originalChar;
          node.isGlitch = false;
        }
      }
    }
  }

  /**
   * Renders the dense living code sclera clipped to the eye geometry
   */
  render(ctx, eyeGeometry, irisX, irisY, irisRadius) {
    if (!this.isInitialized) {
      this.initRows();
    }

    const cx = eyeGeometry.cx;
    const cy = eyeGeometry.cy;
    const halfW = eyeGeometry.halfW;
    const halfH = eyeGeometry.halfH;
    const eyeW = eyeGeometry.width;

    const colors = {
      bright: '#ffffff',
      silver: '#e2e8f0',
      slate: '#94a3b8',
      dim: '#64748b',
      blue: '#93c5fd',
      violet: '#c4b5fd'
    };

    ctx.save();

    // 1. Clip strictly to the dynamic eyelid mask
    const clipPath = eyeGeometry.createEyeClipPath();
    ctx.clip(clipPath);

    // 2. Base Sclera Shading Background:
    // Rich deep silver-charcoal radial gradient that code sits upon
    const scleraGrad = ctx.createRadialGradient(
      cx, cy, halfW * 0.12,
      cx, cy, halfW
    );
    scleraGrad.addColorStop(0.0, 'rgba(10, 6, 18, 0.98)');
    scleraGrad.addColorStop(0.35, 'rgba(22, 16, 34, 0.82)');
    scleraGrad.addColorStop(0.72, 'rgba(15, 10, 24, 0.90)');
    scleraGrad.addColorStop(1.0, 'rgba(5, 2, 9, 0.99)');

    ctx.fillStyle = scleraGrad;
    ctx.fill(clipPath);

    // 3. Dense living micro-code rendering (Optimized 60 FPS pipeline)
    const charSpacing = (CONFIG.codeField && CONFIG.codeField.charWidthApprox) || 8.0;
    const rowHeight = 11.5; // Optimal vertical density without CPU overdraw
    const totalRows = Math.floor((halfH * 2.3) / rowHeight);
    const startY = cy - halfH * 1.15;

    // Detect active eyelid vertical aperture to cull rows outside visible slit
    const upperApexY = Math.min(eyeGeometry.currentUpper.p1.y, eyeGeometry.currentUpper.p2.y);
    const lowerApexY = Math.max(eyeGeometry.currentLower.p1.y, eyeGeometry.currentLower.p2.y);
    const minVisibleY = upperApexY - rowHeight * 1.5;
    const maxVisibleY = lowerApexY + rowHeight * 1.5;

    ctx.font = `${(CONFIG.codeField && CONFIG.codeField.fontSize) || 9.0}px "JetBrains Mono", Consolas, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const irisDarkenThreshold = irisRadius * CONFIG.codeField.irisDarkeningRadiusRatio;
    const irisInnerThreshold = irisRadius * 0.86;

    let currentColor = null;
    let currentAlpha = -1;

    for (let r = 0; r < totalRows; r++) {
      const baseY = startY + r * rowHeight;
      if (baseY < minVisibleY || baseY > maxVisibleY) continue;

      const normY = (baseY - cy) / halfH; // -1 (top) to +1 (bottom)
      const rowData = this.rows[r % this.rows.length];
      const rowChars = rowData.characters;

      const upperLidShadow = smoothstep(-1.15, -0.25, normY);
      const numSteps = Math.floor(eyeW / charSpacing);

      for (let s = 0; s < numSteps; s++) {
        const u = s / numSteps;
        const x = (cx - halfW) + u * eyeW;

        const normX = (x - cx) / halfW;
        if (Math.abs(normX) > 0.996) continue;

        // Natural eyelid contour arching
        const archFactor = Math.cos(normX * (Math.PI * 0.5));
        let archOffset = 0;
        if (normY < 0) {
          archOffset = -archFactor * (Math.abs(normY) * halfH * 0.15);
        } else {
          archOffset = archFactor * (normY * halfH * 0.12);
        }

        const y = baseY + archOffset;

        // Distance from current dynamic iris center
        const dx = x - irisX;
        const dy = y - irisY;
        const distToIris = Math.sqrt(dx * dx + dy * dy);

        if (distToIris < irisInnerThreshold) {
          continue; // Occluded behind the dark iris
        }

        let irisAlphaFactor = 1.0;
        if (distToIris < irisDarkenThreshold) {
          irisAlphaFactor = smoothstep(irisInnerThreshold, irisDarkenThreshold, distToIris);
        }

        const charIndex = Math.floor((s * charSpacing + rowData.driftOffset) / charSpacing) % rowChars.length;
        const node = rowChars[(charIndex + rowChars.length) % rowChars.length];

        const finalAlpha = node.baseAlpha * upperLidShadow * irisAlphaFactor;
        if (finalAlpha < 0.05) continue;

        // Direct fast rendering without expensive per-character save/restore stack allocation
        const roundedAlpha = Math.round(finalAlpha * 10) / 10;
        if (currentAlpha !== roundedAlpha) {
          currentAlpha = roundedAlpha;
          ctx.globalAlpha = roundedAlpha;
        }
        if (currentColor !== node.colorType) {
          currentColor = node.colorType;
          ctx.fillStyle = colors[currentColor] || colors.silver;
        }

        ctx.fillText(node.char, x, y);
      }
    }

    // 4. Upper Eyelid Deep Anatomical Cast Shadow Gradient
    const shadowGrad = ctx.createLinearGradient(
      cx, cy - halfH,
      cx, cy
    );
    shadowGrad.addColorStop(0.0, 'rgba(4, 2, 8, 0.78)');
    shadowGrad.addColorStop(0.35, 'rgba(8, 4, 14, 0.48)');
    shadowGrad.addColorStop(1.0, 'rgba(10, 5, 18, 0.0)');

    ctx.fillStyle = shadowGrad;
    ctx.fill(clipPath);

    ctx.restore();
  }
}
