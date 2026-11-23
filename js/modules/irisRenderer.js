/**
 * ULTRON & JARVIS — Dual AI Procedural Iris & Pupil Renderer
 * Supports smooth 800ms color transitions between ULTRON (Crimson) and JARVIS (Ocean Blue).
 */

import { CONFIG } from '../config.js';
import { SeededPRNG, clamp, lerp } from '../math/utils.js';

export class IrisRenderer {
  constructor() {
    // Offscreen canvases for pre-rendered textures
    this.ultronCanvas = document.createElement('canvas');
    this.ultronCtx = this.ultronCanvas.getContext('2d');

    this.jarvisCanvas = document.createElement('canvas');
    this.jarvisCtx = this.jarvisCanvas.getContext('2d');

    this.cachedSize = 0;
    this.isGenerated = false;
  }

  /**
   * Generates or refreshes procedural iris textures for both AI themes (cached once)
   */
  generateTextures(radius = 320) {
    if (this.isGenerated && this.cachedSize > 0) return;

    // Use a high-fidelity canonical texture dimension (640x640) for crisp retina scaling
    const canonicalRadius = 320;
    const canonicalSize = canonicalRadius * 2;
    this.cachedSize = canonicalSize;
    
    // Generate both theme textures with identical structural seeds once
    this.renderSingleThemeTexture(this.ultronCanvas, this.ultronCtx, canonicalSize, canonicalRadius, CONFIG.themes.ULTRON);
    this.renderSingleThemeTexture(this.jarvisCanvas, this.jarvisCtx, canonicalSize, canonicalRadius, CONFIG.themes.JARVIS);

    this.isGenerated = true;
  }

  /**
   * Generates a procedural iris disc for a specific theme
   */
  renderSingleThemeTexture(canvas, ctx, size, radius, theme) {
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const R = radius;
    const pupilR = R * CONFIG.eye.pupilRadiusRatio;

    // 1. Base Radial Gradient
    const baseGrad = ctx.createRadialGradient(cx, cy, pupilR * 0.65, cx, cy, R);
    baseGrad.addColorStop(0.0, theme.irisBase.center);
    baseGrad.addColorStop(0.25, theme.irisBase.inner);
    baseGrad.addColorStop(0.55, theme.irisBase.mid);
    baseGrad.addColorStop(0.85, theme.irisBase.outer);
    baseGrad.addColorStop(1.0, theme.irisBase.limbus);

    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // 2. Procedural Radial Fibers (Identical seed 54321 for 1-to-1 anatomical morphing)
    const prng = new SeededPRNG(54321);
    const fiberCount = 2000;

    for (let i = 0; i < fiberCount; i++) {
      const angle = (i / fiberCount) * Math.PI * 2 + prng.range(-0.002, 0.002);
      const startDist = pupilR * prng.range(0.88, 1.04);
      const endDist = R * prng.range(0.91, 0.995);

      const isAccent = prng.next() < 0.28; // 28% theme accent fibers, 72% dark charcoal
      let strokeColor;

      if (isAccent) {
        const af = theme.accentFiber;
        const alpha = prng.range(af.alphaMin, af.alphaMax);
        const r = Math.floor(prng.range(af.rMin, af.rMax));
        const g = Math.floor(prng.range(af.gMin, af.gMax));
        const b = Math.floor(prng.range(af.bMin, af.bMax));
        strokeColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } else {
        const cf = theme.charcoalFiber;
        const alpha = prng.range(0.08, 0.35);
        const grey = Math.floor(prng.range(cf.min, cf.max));
        strokeColor = `rgba(${grey + cf.rDelta}, ${grey + cf.gDelta}, ${grey + cf.bDelta}, ${alpha})`;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = prng.range(0.5, 1.25);

      // Wavy biological filament path
      ctx.beginPath();
      const waveFreq = prng.range(10, 22);
      const waveAmp = prng.range(0.6, 1.8);

      const steps = 14;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const curDist = startDist + (endDist - startDist) * t;
        const wave = Math.sin(t * waveFreq) * waveAmp * (1 - t * 0.35);
        const currentAngle = angle + wave / curDist;

        const fx = cx + Math.cos(currentAngle) * curDist;
        const fy = cy + Math.sin(currentAngle) * curDist;

        if (s === 0) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }

    // 3. Iris Collarette (intricate scalloped zig-zag ridge)
    const collaretteR = pupilR * 1.82;
    ctx.save();
    ctx.beginPath();
    const collarettePoints = 84;
    for (let c = 0; c <= collarettePoints; c++) {
      const a = (c / collarettePoints) * Math.PI * 2;
      const rOffset = Math.sin(a * 22) * (R * 0.028) + prng.range(-1.2, 1.2);
      const cr = collaretteR + rOffset;
      const px = cx + Math.cos(a) * cr;
      const py = cy + Math.sin(a) * cr;
      if (c === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = theme.collarette;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    // 4. Concentric Contraction Furrows
    const ringCount = 10;
    for (let r = 0; r < ringCount; r++) {
      const ringRadius = collaretteR + (R - collaretteR) * ((r + 1) / (ringCount + 1));
      
      // Shadow groove
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(3, 1, 5, 0.70)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Theme highlight ridge
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius + 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = theme.contractionRing;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // 5. Limbus Feathered Outer Border
    const limbusGrad = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    limbusGrad.addColorStop(0.0, 'rgba(5, 3, 8, 0)');
    limbusGrad.addColorStop(0.68, 'rgba(4, 2, 6, 0.75)');
    limbusGrad.addColorStop(1.0, 'rgba(2, 1, 4, 0.99)');

    ctx.fillStyle = limbusGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Renders the iris with smooth theme transition, dynamic pupil, and corneal reflections
   * @param {number} themeProgress 0.0 = 100% ULTRON (Crimson), 1.0 = 100% JARVIS (Ocean Blue)
   */
  render(ctx, irisX, irisY, irisRadius, pupilDilation, gazeX = 0, gazeY = 0, themeProgress = 0) {
    if (!this.isGenerated) {
      this.generateTextures(irisRadius);
    }

    const drawSize = irisRadius * 2;
    const drawX = irisX - irisRadius;
    const drawY = irisY - irisRadius;
    const progress = clamp(themeProgress, 0, 1);

    ctx.save();

    // 1. Draw Theme Textures with Smooth Organic Cross-Fading (Hardware GPU Scaled)
    if (progress <= 0.001) {
      // 100% ULTRON
      ctx.drawImage(this.ultronCanvas, drawX, drawY, drawSize, drawSize);
    } else if (progress >= 0.999) {
      // 100% JARVIS
      ctx.drawImage(this.jarvisCanvas, drawX, drawY, drawSize, drawSize);
    } else {
      // Smooth 1-to-1 Morphing Transition
      ctx.drawImage(this.ultronCanvas, drawX, drawY, drawSize, drawSize);

      ctx.save();
      ctx.globalAlpha = progress;
      ctx.drawImage(this.jarvisCanvas, drawX, drawY, drawSize, drawSize);
      ctx.restore();
    }

    // 2. Dynamic Deep Black Pupil
    const currentPupilR = irisRadius * CONFIG.eye.pupilRadiusRatio * clamp(pupilDilation, 0.85, 1.22);

    ctx.fillStyle = '#010103'; // Preserved absolute black pupil in both modes
    ctx.beginPath();
    ctx.arc(irisX, irisY, currentPupilR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Pupillary Ruff (Interpolated between Oxblood Maroon and Deep Oceanic Teal)
    const ruffR = Math.floor(lerp(48, 12, progress));
    const ruffG = Math.floor(lerp(10, 42, progress));
    const ruffB = Math.floor(lerp(20, 60, progress));

    const ruffGrad = ctx.createRadialGradient(
      irisX, irisY, currentPupilR * 0.92,
      irisX, irisY, currentPupilR * 1.12
    );
    ruffGrad.addColorStop(0.0, 'rgba(1, 1, 3, 1)');
    ruffGrad.addColorStop(0.45, `rgba(${ruffR}, ${ruffG}, ${ruffB}, 0.58)`);
    ruffGrad.addColorStop(1.0, 'rgba(8, 6, 12, 0)');

    ctx.fillStyle = ruffGrad;
    ctx.beginPath();
    ctx.arc(irisX, irisY, currentPupilR * 1.12, 0, Math.PI * 2);
    ctx.fill();

    // 4. Subtle Iris Ambient Glow (Restrained deep crimson in Ultron, deep ocean in Jarvis)
    const glowR = Math.floor(lerp(90, 20, progress));
    const glowG = Math.floor(lerp(16, 75, progress));
    const glowB = Math.floor(lerp(28, 115, progress));

    const glowGrad = ctx.createRadialGradient(
      irisX, irisY, currentPupilR * 1.1,
      irisX, irisY, irisRadius * 0.95
    );
    glowGrad.addColorStop(0.0, `rgba(${glowR}, ${glowG}, ${glowB}, 0.16)`);
    glowGrad.addColorStop(0.7, `rgba(${glowR}, ${glowG}, ${glowB}, 0.05)`);
    glowGrad.addColorStop(1.0, `rgba(${glowR}, ${glowG}, ${glowB}, 0.0)`);

    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisRadius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // 5. Corneal Specular Highlights & 3D Depth
    const reflOffsetX = -gazeX * irisRadius * 0.14;
    const reflOffsetY = -gazeY * irisRadius * 0.10;

    // Curved Monitor Screen Reflection Bar
    ctx.save();
    ctx.translate(irisX + reflOffsetX, irisY + reflOffsetY);
    ctx.rotate(-0.16);

    const barR = Math.floor(lerp(230, 215, progress));
    const barG = Math.floor(lerp(220, 235, progress));
    const barB = Math.floor(lerp(230, 255, progress));

    const screenBarGrad = ctx.createLinearGradient(
      -irisRadius * 0.42, -irisRadius * 0.48,
      irisRadius * 0.42, -irisRadius * 0.28
    );
    screenBarGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    screenBarGrad.addColorStop(0.35, `rgba(${barR}, ${barG}, ${barB}, 0.15)`);
    screenBarGrad.addColorStop(0.65, `rgba(${barR}, ${barG}, ${barB}, 0.22)`);
    screenBarGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = screenBarGrad;
    ctx.beginPath();
    ctx.ellipse(
      -irisRadius * 0.08, -irisRadius * 0.36,
      irisRadius * 0.42, irisRadius * 0.13,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Soft Ambient Room Light Reflection
    ctx.save();
    ctx.translate(irisX + reflOffsetX, irisY + reflOffsetY);
    const softAmbGrad = ctx.createRadialGradient(
      irisRadius * 0.22, -irisRadius * 0.24, 0,
      irisRadius * 0.22, -irisRadius * 0.24, irisRadius * 0.28
    );
    softAmbGrad.addColorStop(0.0, `rgba(${barR}, ${barG}, ${barB}, 0.18)`);
    softAmbGrad.addColorStop(0.5, `rgba(${barR}, ${barG}, ${barB}, 0.06)`);
    softAmbGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = softAmbGrad;
    ctx.beginPath();
    ctx.arc(irisRadius * 0.22, -irisRadius * 0.24, irisRadius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Delicate 2.5px Pinpoint Corneal Specular Glint
    const glintX = irisX + reflOffsetX + irisRadius * 0.24;
    const glintY = irisY + reflOffsetY - irisRadius * 0.26;

    const glintGrad = ctx.createRadialGradient(glintX, glintY, 0, glintX, glintY, 3.8);
    glintGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    glintGrad.addColorStop(0.4, 'rgba(240, 245, 255, 0.45)');
    glintGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = glintGrad;
    ctx.beginPath();
    ctx.arc(glintX, glintY, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
