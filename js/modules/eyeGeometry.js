/**
 * JARVIS — Mathematical Eye Geometry & Dynamic Eyelid Clipping Paths
 */

import { CONFIG } from '../config.js';
import { lerp, clamp } from '../math/utils.js';
import { evalCubicBezier } from '../math/bezier.js';

export class EyeGeometry {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.cx = 0;
    this.cy = 0;
    this.halfW = 0;
    this.halfH = 0;
    
    // Iris & pupil sizes in screen pixels
    this.irisRadius = 0;
    this.pupilRadius = 0;

    // Bezier control curves for open eye
    this.openUpper = null;
    this.openLower = null;

    // Current dynamic curves (accounting for blinking)
    this.currentUpper = null;
    this.currentLower = null;
  }

  /**
   * Recalculates eye geometry based on viewport canvas size
   */
  resize(canvasWidth, canvasHeight) {
    const cfg = CONFIG.eye;

    // Determine horizontal eye width based on viewport
    let w = canvasWidth * cfg.widthPercent;
    w = clamp(w, cfg.minWidth, cfg.maxWidth);

    // Height based on horizontal elongated almond aspect ratio
    const h = w / cfg.aspectRatio;

    const cx = canvasWidth * 0.5;
    const cy = canvasHeight * cfg.centerYOffset;

    this.width = w;
    this.height = h;
    this.cx = cx;
    this.cy = cy;
    this.halfW = w * 0.5;
    this.halfH = h * 0.5;

    this.irisRadius = w * cfg.irisRadiusRatio;
    this.pupilRadius = this.irisRadius * cfg.pupilRadiusRatio;

    // Build anatomical Bezier curves for open eye
    this.computeStaticCurves();
  }

  /**
   * Constructs the anatomical Bezier curves for the almond eye
   */
  computeStaticCurves() {
    const leftX = this.cx - this.halfW;
    const rightX = this.cx + this.halfW;
    const centerY = this.cy;

    // Natural asymmetry: Upper lid apex is shifted slightly nasal (~46% from left),
    // and lower lid lowest point is shifted slightly temporal (~54% from left)
    const upperApexY = centerY - this.halfH * CONFIG.eye.upperLidArch;
    const lowerLowestY = centerY + this.halfH * CONFIG.eye.lowerLidArch;

    // Upper eyelid curve control points
    this.openUpper = {
      p0: { x: leftX, y: centerY },
      p1: { x: leftX + this.width * 0.22, y: upperApexY * 1.02 },
      p2: { x: leftX + this.width * 0.68, y: upperApexY * 0.98 },
      p3: { x: rightX, y: centerY }
    };

    // Lower eyelid curve control points
    this.openLower = {
      p0: { x: leftX, y: centerY },
      p1: { x: leftX + this.width * 0.32, y: lowerLowestY * 0.96 },
      p2: { x: leftX + this.width * 0.78, y: lowerLowestY * 1.02 },
      p3: { x: rightX, y: centerY }
    };

    // Initialize dynamic curves
    this.currentUpper = JSON.parse(JSON.stringify(this.openUpper));
    this.currentLower = JSON.parse(JSON.stringify(this.openLower));
  }

  /**
   * Updates dynamic eyelid curves given the current blink progress
   * @param {number} blinkProgress 0.0 = fully open, 1.0 = fully closed
   */
  updateBlink(blinkProgress) {
    const bp = clamp(blinkProgress, 0, 1);
    const upperTravel = CONFIG.blink.upperTravelRatio; // ~0.82
    const lowerTravel = CONFIG.blink.lowerTravelRatio; // ~0.18

    // The organic closure seam curve (natural curved contact line between lids)
    const seamLeftX = this.cx - this.halfW;
    const seamRightX = this.cx + this.halfW;
    const seamCenterY = this.cy + this.halfH * 0.16; // Slightly below geometric center

    const seamCurve = {
      p0: { x: seamLeftX, y: this.cy },
      p1: { x: seamLeftX + this.width * 0.28, y: seamCenterY + this.halfH * 0.08 },
      p2: { x: seamLeftX + this.width * 0.72, y: seamCenterY + this.halfH * 0.06 },
      p3: { x: seamRightX, y: this.cy }
    };

    // Interpolate upper lid towards the seam curve
    this.currentUpper = {
      p0: {
        x: lerp(this.openUpper.p0.x, seamCurve.p0.x, bp),
        y: lerp(this.openUpper.p0.y, seamCurve.p0.y, bp)
      },
      p1: {
        x: lerp(this.openUpper.p1.x, seamCurve.p1.x, bp),
        y: lerp(this.openUpper.p1.y, seamCurve.p1.y, bp * upperTravel * 1.22)
      },
      p2: {
        x: lerp(this.openUpper.p2.x, seamCurve.p2.x, bp),
        y: lerp(this.openUpper.p2.y, seamCurve.p2.y, bp * upperTravel * 1.22)
      },
      p3: {
        x: lerp(this.openUpper.p3.x, seamCurve.p3.x, bp),
        y: lerp(this.openUpper.p3.y, seamCurve.p3.y, bp)
      }
    };

    // Interpolate lower lid towards the seam curve
    this.currentLower = {
      p0: {
        x: lerp(this.openLower.p0.x, seamCurve.p0.x, bp),
        y: lerp(this.openLower.p0.y, seamCurve.p0.y, bp)
      },
      p1: {
        x: lerp(this.openLower.p1.x, seamCurve.p1.x, bp),
        y: lerp(this.openLower.p1.y, seamCurve.p1.y, bp * lowerTravel * 5.2)
      },
      p2: {
        x: lerp(this.openLower.p2.x, seamCurve.p2.x, bp),
        y: lerp(this.openLower.p2.y, seamCurve.p2.y, bp * lowerTravel * 5.2)
      },
      p3: {
        x: lerp(this.openLower.p3.x, seamCurve.p3.x, bp),
        y: lerp(this.openLower.p3.y, seamCurve.p3.y, bp)
      }
    };
  }

  /**
   * Constructs Path2D representing the current eye opening mask
   */
  createEyeClipPath() {
    const path = new Path2D();
    const up = this.currentUpper;
    const lo = this.currentLower;

    path.moveTo(up.p0.x, up.p0.y);
    // Draw upper eyelid from left canthus to right canthus
    path.bezierCurveTo(up.p1.x, up.p1.y, up.p2.x, up.p2.y, up.p3.x, up.p3.y);
    // Draw lower eyelid from right canthus back to left canthus
    path.bezierCurveTo(lo.p2.x, lo.p2.y, lo.p1.x, lo.p1.y, lo.p0.x, lo.p0.y);
    path.closePath();

    return path;
  }

  /**
   * Returns whether a given (x, y) point is inside the current eye opening
   */
  isPointInside(x, y) {
    if (x < this.cx - this.halfW || x > this.cx + this.halfW) return false;
    const u = (x - (this.cx - this.halfW)) / this.width;
    const topPt = evalCubicBezier(this.currentUpper.p0, this.currentUpper.p1, this.currentUpper.p2, this.currentUpper.p3, u);
    const botPt = evalCubicBezier(this.currentLower.p0, this.currentLower.p1, this.currentLower.p2, this.currentLower.p3, u);
    return y >= topPt.y && y <= botPt.y;
  }
}
