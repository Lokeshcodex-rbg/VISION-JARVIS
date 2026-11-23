/**
 * ULTRON × JARVIS — Continuous Full-Viewport Background Code Matrix Engine
 * Interpolates full-screen atmospheric gradients, code accents, and ambient aura
 * between ULTRON (Deep Purple-Crimson) and JARVIS (Midnight Ocean-Teal).
 */

import { clamp, lerp, randomRange, randomChoice } from '../math/utils.js';
import { CONFIG } from '../config.js';

// Comprehensive repository of authentic AI, C++, Python, WebGL, hex, and system logs
const CODE_LIBRARY = [
  // C++ / CUDA kernels & systems
  'template <typename Tensor> __global__ void neural_ocular_forward(const Tensor* __restrict__ in, Tensor* out) {',
  '  alignas(64) volatile uint64_t quantum_reg = 0x7FFF80C2A0ULL;',
  '  const int tid = blockIdx.x * blockDim.x + threadIdx.x;',
  '  if (tid >= 0x8000) return;',
  '  out[tid] = __fmaf_rn(in[tid], 0.9984f, 0.0016f);',
  '} // namespace jarvis::vision::core',
  'std::atomic<bool> ocular_bus_ready{true}; std::atomic_thread_fence(std::memory_order_seq_cst);',
  'void* const p_mapped = ::mmap(nullptr, 0x100000, PROT_READ | PROT_WRITE, MAP_ANON | MAP_SHARED, -1, 0);',
  '__m256 v_entropy = _mm256_fmadd_ps(v_a, v_b, _mm256_set1_ps(0.9984f));',
  'auto iris_trabecular = std::make_unique<TrabecularMesh>(MeshTopology::ORGANIC);',
  '#pragma omp parallel for schedule(guided) num_threads(16)',

  // Python / PyTorch / Deep Learning
  'def forward_spatial_attention(query: Tensor, key: Tensor, mask: Optional[Tensor] = None) -> Tensor:',
  '    scores = torch.matmul(query, key.transpose(-2, -1)) / math.sqrt(d_k)',
  '    if mask is not None: scores = scores.masked_fill(mask == 0, -1e9)',
  '    return torch.softmax(scores, dim=-1)',
  'with torch.cuda.amp.autocast(dtype=torch.bfloat16):',
  '    latent_gaze = model.encoder.forward_spatial(retina_frames)',
  '    loss = criterion(latent_gaze, target_vector) + 0.002 * l2_penalty',
  'optimizer.zero_grad(set_to_none=True); scaler.scale(loss).backward()',
  'scaler.step(optimizer); scaler.update(); scheduler.step()',

  // JavaScript / Modern WebGPU / Systems
  'const gpuBuffer = device.createBuffer({ size: 1048576, usage: GPUBufferUsage.STORAGE });',
  'class SynapticMeshPipeline extends TransformStream<OcularPacket, GazeVector> {',
  '  async initializeComputePipeline(device: GPUDevice): Promise<void> {',
  '    this.computePipeline = await device.createComputePipelineAsync({ layout: "auto" });',
  '  }',
  '}',
  'async function* streamQuantumEntropy(seed = 0xCAFE): AsyncGenerator<Float32Array> {',
  '  while (isOcularActive) yield crypto.getRandomValues(new Float32Array(256));',
  '}',

  // Hexadecimal dumps & memory registers
  '0x00007FFF80C2A0: 48 89 5C 24 08 48 89 6C 24 10 48 89 74 24 18 57 48 83',
  '0x00007FFF80C2B0: EC 20 41 8B D8 48 8B F9 48 8D 4C 24 30 E8 85 C0 78 4A',
  '0x00007FFF80C2C0: 48 8B 4C 24 30 48 85 C9 74 12 48 8B 41 8B 04 0A 48 83',
  '0x00007FFF80C2D0: C1 04 48 39 D1 75 F3 48 8B 5C 24 38 48 8B 74 24 40 C3',
  '0x00007FFF80C2E0: 90 48 83 EC 28 E8 4B FF FF FF 48 83 C4 28 C3 00 00 00',

  // AI Telemetry & Security Logs
  '[SEC_KERNEL] Quantum handshake verified. Status: NOMINAL // Bus 0x01',
  '[RETINA_AI] Saccadic trajectory calibrated. Confidence: 99.984%',
  '[FOVEA_STREAM] Frame 0x8F4A streamed via PCIe Gen5 x16 @ 60.0 FPS',
  '[SYS_HEALTH] Core thermal junction: 34.8C. Synaptic throttle: NONE',
  '[DECRYPT] Stream packet hash: 0xDEADBEEFCAFEBABE // INTEGRITY OK',
  '[NEURAL_LOCK] Iris contour aligned. Palpebral fissure: 3.48 ratio',
  '[DMA_XFER] 65,536 f32 tensors transferred to GPU L2 cache (0.012ms)',

  // Binary Sequences
  '01001010 01000001 01010010 01010110 01001001 01010011 00100000 01000101',
  '01011001 01000101 00100000 01000011 01001111 01010010 01000101 00100000',
  '01100001 01100011 01110100 01101001 01110110 01100101 00100000 01101111'
];

const GLYPH_CHARS = '0101010123456789ABCDEFabcdef{}[]<>()/*+=~;:!$_-&|^%#@?';

export class BackgroundCodeMatrix {
  constructor() {
    this.columns = [];
    this.hexColumns = [];
    this.scanlineY = 0;
    this.scanlineSpeed = 45; // pixels per second
    this.initialized = false;
  }

  init(width, height) {
    this.columns = [];
    this.hexColumns = [];

    const colWidth = clamp(width / 3.2, 380, 560);
    const numCols = Math.ceil(width / colWidth) + 1;

    for (let c = 0; c < numCols; c++) {
      const startX = c * colWidth + 14;
      const lines = [];
      const lineCount = Math.ceil(height / 17) + 6;

      for (let l = 0; l < lineCount; l++) {
        lines.push({
          text: randomChoice(CODE_LIBRARY),
          glitchCharIdx: -1,
          glitchChar: '',
          flickerAlpha: 1.0
        });
      }

      this.columns.push({
        x: startX,
        yOffset: randomRange(0, 300),
        speed: randomRange(14, 24) * (c % 2 === 0 ? 1 : 1.15),
        lineHeight: 18,
        fontSize: 10,
        lines: lines
      });
    }

    const flankCount = 4;
    for (let f = 0; f < flankCount; f++) {
      const isRight = f >= flankCount / 2;
      const fx = isRight ? width - 180 + (f - 2) * 85 : 20 + f * 85;
      const hexLines = [];
      const count = Math.ceil(height / 14) + 6;

      for (let h = 0; h < count; h++) {
        hexLines.push(this.generateHexLine());
      }

      this.hexColumns.push({
        x: fx,
        yOffset: randomRange(0, 500),
        speed: randomRange(28, 48),
        lineHeight: 14,
        fontSize: 8.5,
        lines: hexLines
      });
    }

    this.scanlineY = 0;
    this.initialized = true;
  }

  generateHexLine() {
    const addr = '0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    let bytes = '';
    for (let b = 0; b < 4; b++) {
      bytes += Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0') + ' ';
    }
    return `${addr}: ${bytes.trim()}`;
  }

  update(dtSec, width, height) {
    if (!this.initialized) {
      this.init(width, height);
      return;
    }

    for (let c = 0; c < this.columns.length; c++) {
      const col = this.columns[c];
      col.yOffset -= col.speed * dtSec;

      if (col.yOffset <= -col.lineHeight) {
        col.yOffset += col.lineHeight;
        col.lines.shift();
        col.lines.push({
          text: randomChoice(CODE_LIBRARY),
          glitchCharIdx: -1,
          glitchChar: '',
          flickerAlpha: 1.0
        });
      }

      for (let l = 0; l < col.lines.length; l++) {
        const line = col.lines[l];
        if (Math.random() < 0.003 && line.text.length > 5) {
          line.glitchCharIdx = Math.floor(Math.random() * line.text.length);
          line.glitchChar = randomChoice(GLYPH_CHARS);
        } else if (line.glitchCharIdx >= 0 && Math.random() < 0.1) {
          line.glitchCharIdx = -1;
        }
      }
    }

    for (let f = 0; f < this.hexColumns.length; f++) {
      const col = this.hexColumns[f];
      col.yOffset -= col.speed * dtSec;
      if (col.yOffset <= -col.lineHeight) {
        col.yOffset += col.lineHeight;
        col.lines.shift();
        col.lines.push(this.generateHexLine());
      }
    }

    this.scanlineY = (this.scanlineY + this.scanlineSpeed * dtSec) % height;
  }

  /**
   * Renders the dynamic background gradient, ambient eye aura, and streaming code matrix
   * with smooth theme interpolation between ULTRON and JARVIS
   */
  render(ctx, width, height, eyeGeometry, themeProgress = 0) {
    if (!this.initialized) {
      this.init(width, height);
    }

    const t = clamp(themeProgress, 0, 1);
    const uBg = CONFIG.themes.ULTRON.background;
    const jBg = CONFIG.themes.JARVIS.background;

    // 1. Interpolated Atmospheric Radial Background Gradient
    // Smoothly morphs from Deep Purple-Black (ULTRON) to Deep Midnight-Ocean (JARVIS)
    const cR = Math.floor(lerp(uBg.gradCenter[0], jBg.gradCenter[0], t));
    const cG = Math.floor(lerp(uBg.gradCenter[1], jBg.gradCenter[1], t));
    const cB = Math.floor(lerp(uBg.gradCenter[2], jBg.gradCenter[2], t));

    const iR = Math.floor(lerp(uBg.gradInner[0], jBg.gradInner[0], t));
    const iG = Math.floor(lerp(uBg.gradInner[1], jBg.gradInner[1], t));
    const iB = Math.floor(lerp(uBg.gradInner[2], jBg.gradInner[2], t));

    const mR = Math.floor(lerp(uBg.gradMid[0], jBg.gradMid[0], t));
    const mG = Math.floor(lerp(uBg.gradMid[1], jBg.gradMid[1], t));
    const mB = Math.floor(lerp(uBg.gradMid[2], jBg.gradMid[2], t));

    const oR = Math.floor(lerp(uBg.gradOuter[0], jBg.gradOuter[0], t));
    const oG = Math.floor(lerp(uBg.gradOuter[1], jBg.gradOuter[1], t));
    const oB = Math.floor(lerp(uBg.gradOuter[2], jBg.gradOuter[2], t));

    const bgGrad = ctx.createRadialGradient(
      width * 0.5, height * 0.30, width * 0.08,
      width * 0.5, height * 0.5, width * 0.88
    );
    bgGrad.addColorStop(0.0, `rgb(${cR}, ${cG}, ${cB})`);
    bgGrad.addColorStop(0.35, `rgb(${iR}, ${iG}, ${iB})`);
    bgGrad.addColorStop(0.70, `rgb(${mR}, ${mG}, ${mB})`);
    bgGrad.addColorStop(1.0, `rgb(${oR}, ${oG}, ${oB})`);

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient Illumination Aura Behind the Eye
    // Deep crimson aura (ULTRON) -> Subtle blue/teal illumination (JARVIS)
    const auraR = Math.floor(lerp(uBg.eyeAura[0], jBg.eyeAura[0], t));
    const auraG = Math.floor(lerp(uBg.eyeAura[1], jBg.eyeAura[1], t));
    const auraB = Math.floor(lerp(uBg.eyeAura[2], jBg.eyeAura[2], t));
    const auraA = lerp(uBg.eyeAura[3], jBg.eyeAura[3], t);

    const eyeAuraGrad = ctx.createRadialGradient(
      eyeGeometry.cx, eyeGeometry.cy, eyeGeometry.halfW * 0.2,
      eyeGeometry.cx, eyeGeometry.cy, eyeGeometry.halfW * 1.35
    );
    eyeAuraGrad.addColorStop(0.0, `rgba(${auraR}, ${auraG}, ${auraB}, ${auraA})`);
    eyeAuraGrad.addColorStop(0.65, `rgba(${auraR}, ${auraG}, ${auraB}, ${auraA * 0.35})`);
    eyeAuraGrad.addColorStop(1.0, `rgba(${auraR}, ${auraG}, ${auraB}, 0.0)`);

    ctx.fillStyle = eyeAuraGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.textBaseline = 'top';

    const eyeCx = eyeGeometry.cx;
    const eyeCy = eyeGeometry.cy;
    const eyeHalfW = eyeGeometry.halfW;
    const eyeHalfH = eyeGeometry.halfH;

    // Interpolated Accent Color Vectors for Code Lines
    const accR = Math.floor(lerp(uBg.codeAccent[0], jBg.codeAccent[0], t));
    const accG = Math.floor(lerp(uBg.codeAccent[1], jBg.codeAccent[1], t));
    const accB = Math.floor(lerp(uBg.codeAccent[2], jBg.codeAccent[2], t));

    const telR = Math.floor(lerp(uBg.codeTelemetry[0], jBg.codeTelemetry[0], t));
    const telG = Math.floor(lerp(uBg.codeTelemetry[1], jBg.codeTelemetry[1], t));
    const telB = Math.floor(lerp(uBg.codeTelemetry[2], jBg.codeTelemetry[2], t));

    // 3. Render Layer 2: Fast Telemetry & Hex Columns on Flanks and Corners
    ctx.font = '8.5px "JetBrains Mono", Consolas, monospace';
    const hexColorNear = `rgba(${telR}, ${telG}, ${telB}, 0.085)`;
    const hexColorFar = `rgba(${telR}, ${telG}, ${telB}, 0.045)`;
    let currentHexFill = null;

    for (let f = 0; f < this.hexColumns.length; f++) {
      const col = this.hexColumns[f];

      for (let l = 0; l < col.lines.length; l++) {
        const y = col.yOffset + l * col.lineHeight;
        if (y < -20 || y > height + 20) continue;

        const dx = (col.x - eyeCx) / eyeHalfW;
        const dy = (y - eyeCy) / eyeHalfH;
        const distNorm = Math.sqrt(dx * dx + dy * dy);

        const targetFill = distNorm < 1.4 ? hexColorNear : hexColorFar;
        if (currentHexFill !== targetFill) {
          currentHexFill = targetFill;
          ctx.fillStyle = targetFill;
        }
        ctx.fillText(col.lines[l], col.x, y);
      }
    }

    // 4. Render Layer 1: Continuous Main Code Streams Across Entire Viewport
    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    const colorAccent = `rgba(${accR}, ${accG}, ${accB}, 0.075)`;
    const colorTel = `rgba(${telR}, ${telG}, ${telB}, 0.065)`;
    const tensorR = Math.floor(lerp(210, 56, t));
    const tensorG = Math.floor(lerp(120, 189, t));
    const tensorB = Math.floor(lerp(240, 248, t));
    const colorTensor = `rgba(${tensorR}, ${tensorG}, ${tensorB}, 0.075)`;
    const colorSilver = 'rgba(226, 232, 240, 0.055)';
    let currentMainFill = null;

    for (let c = 0; c < this.columns.length; c++) {
      const col = this.columns[c];

      for (let l = 0; l < col.lines.length; l++) {
        const y = col.yOffset + l * col.lineHeight;
        if (y < -20 || y > height + 20) continue;

        const line = col.lines[l];
        let textToDraw = line.text;
        if (line.glitchCharIdx >= 0 && line.glitchCharIdx < textToDraw.length) {
          textToDraw = textToDraw.substring(0, line.glitchCharIdx) +
                       line.glitchChar +
                       textToDraw.substring(line.glitchCharIdx + 1);
        }

        let targetFill = colorSilver;
        if (textToDraw.startsWith('[')) {
          targetFill = colorAccent;
        } else if (textToDraw.includes('0x') || textToDraw.startsWith('010')) {
          targetFill = colorTel;
        } else if (textToDraw.includes('Tensor') || textToDraw.includes('torch')) {
          targetFill = colorTensor;
        }

        if (currentMainFill !== targetFill) {
          currentMainFill = targetFill;
          ctx.fillStyle = targetFill;
        }

        ctx.fillText(textToDraw, col.x, y);
      }
    }

    // 5. Subtle Moving Data-Scanline Beam (Interpolated Color)
    const scanR = Math.floor(lerp(uBg.scanline[0], jBg.scanline[0], t));
    const scanG = Math.floor(lerp(uBg.scanline[1], jBg.scanline[1], t));
    const scanB = Math.floor(lerp(uBg.scanline[2], jBg.scanline[2], t));
    const scanA = lerp(uBg.scanline[3], jBg.scanline[3], t);

    const scanlineGrad = ctx.createLinearGradient(0, this.scanlineY - 30, 0, this.scanlineY + 30);
    scanlineGrad.addColorStop(0.0, `rgba(${scanR}, ${scanG}, ${scanB}, 0.0)`);
    scanlineGrad.addColorStop(0.5, `rgba(${scanR}, ${scanG}, ${scanB}, ${scanA})`);
    scanlineGrad.addColorStop(1.0, `rgba(${scanR}, ${scanG}, ${scanB}, 0.0)`);

    ctx.fillStyle = scanlineGrad;
    ctx.fillRect(0, this.scanlineY - 30, width, 60);

    ctx.restore();
  }

  /**
   * Renders realistic eyelid waterlines, lash margin, and supratarsal eyelid crease
   */
  renderEyelidMargins(ctx, eyeGeometry) {
    const up = eyeGeometry.currentUpper;
    const lo = eyeGeometry.currentLower;

    ctx.save();

    // 1. Supratarsal Eyelid Crease
    const creaseApexY = eyeGeometry.cy - eyeGeometry.halfH * 1.48;
    const creaseLeftX = eyeGeometry.cx - eyeGeometry.halfW * 0.82;
    const creaseRightX = eyeGeometry.cx + eyeGeometry.halfW * 0.82;

    ctx.strokeStyle = 'rgba(6, 3, 10, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(creaseLeftX, eyeGeometry.cy - eyeGeometry.halfH * 0.45);
    ctx.bezierCurveTo(
      creaseLeftX + eyeGeometry.width * 0.22, creaseApexY,
      creaseLeftX + eyeGeometry.width * 0.62, creaseApexY * 1.02,
      creaseRightX, eyeGeometry.cy - eyeGeometry.halfH * 0.35
    );
    ctx.stroke();

    // 2. Upper Eyelid Intermarginal Waterline
    const upperLidWaterlineGrad = ctx.createLinearGradient(
      eyeGeometry.cx - eyeGeometry.halfW, eyeGeometry.cy,
      eyeGeometry.cx + eyeGeometry.halfW, eyeGeometry.cy
    );
    upperLidWaterlineGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    upperLidWaterlineGrad.addColorStop(0.3, 'rgba(240, 245, 255, 0.32)');
    upperLidWaterlineGrad.addColorStop(0.7, 'rgba(225, 235, 255, 0.24)');
    upperLidWaterlineGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.strokeStyle = upperLidWaterlineGrad;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(up.p0.x, up.p0.y);
    ctx.bezierCurveTo(up.p1.x, up.p1.y, up.p2.x, up.p2.y, up.p3.x, up.p3.y);
    ctx.stroke();

    // 3. Lower Eyelid Waterline
    const lowerLidWaterlineGrad = ctx.createLinearGradient(
      eyeGeometry.cx - eyeGeometry.halfW, eyeGeometry.cy,
      eyeGeometry.cx + eyeGeometry.halfW, eyeGeometry.cy
    );
    lowerLidWaterlineGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    lowerLidWaterlineGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.38)');
    lowerLidWaterlineGrad.addColorStop(0.65, 'rgba(225, 235, 255, 0.26)');
    lowerLidWaterlineGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.strokeStyle = lowerLidWaterlineGrad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lo.p0.x, lo.p0.y);
    ctx.bezierCurveTo(lo.p1.x, lo.p1.y, lo.p2.x, lo.p2.y, lo.p3.x, lo.p3.y);
    ctx.stroke();

    // 4. Subtle Outer Eyelash Micro-Fringes on upper eyelid pointing OUTWARD/UPWARD
    ctx.strokeStyle = 'rgba(2, 1, 4, 0.75)';
    ctx.lineWidth = 1.0;
    const lashCount = 48;
    for (let l = 6; l < lashCount - 6; l++) {
      const u = l / lashCount;
      const du = 0.01;
      
      const invT = 1 - u;
      const px = invT*invT*invT*up.p0.x + 3*invT*invT*u*up.p1.x + 3*invT*u*u*up.p2.x + u*u*u*up.p3.x;
      const py = invT*invT*invT*up.p0.y + 3*invT*invT*u*up.p1.y + 3*invT*u*u*up.p2.y + u*u*u*up.p3.y;

      const uNext = Math.min(1.0, u + du);
      const invTN = 1 - uNext;
      const pNextX = invTN*invTN*invTN*up.p0.x + 3*invTN*invTN*uNext*up.p1.x + 3*invTN*uNext*uNext*up.p2.x + uNext*uNext*uNext*up.p3.x;
      const pNextY = invTN*invTN*invTN*up.p0.y + 3*invTN*invTN*uNext*up.p1.y + 3*invTN*uNext*uNext*up.p2.y + uNext*uNext*uNext*up.p3.y;

      const tx = pNextX - px;
      const ty = pNextY - py;
      const nx = ty;
      const ny = -tx;
      const len = Math.hypot(nx, ny) || 1;

      const lashLen = 2.5 + Math.sin(u * Math.PI) * 4.0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (nx / len) * lashLen, py + (ny / len) * lashLen);
      ctx.stroke();
    }

    ctx.restore();
  }
}
