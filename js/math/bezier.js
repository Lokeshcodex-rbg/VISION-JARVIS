/**
 * JARVIS — Bezier Curve Geometry & Eyelid Arc Evaluation
 */

import { lerp } from './utils.js';

export function evalQuadraticBezier(p0, p1, p2, t) {
  const invT = 1 - t;
  return {
    x: invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x,
    y: invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y
  };
}

export function evalCubicBezier(p0, p1, p2, p3, t) {
  const invT = 1 - t;
  const invT2 = invT * invT;
  const invT3 = invT2 * invT;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: invT3 * p0.x + 3 * invT2 * t * p1.x + 3 * invT * t2 * p2.x + t3 * p3.x,
    y: invT3 * p0.y + 3 * invT2 * t * p1.y + 3 * invT * t2 * p2.y + t3 * p3.y
  };
}

/**
 * Evaluates points on the eyelid contours
 * @param {Object} upperPath Definition of upper eyelid curve
 * @param {Object} lowerPath Definition of lower eyelid curve
 * @param {number} u Horizontal parameter [0, 1] (0 = left corner/canthus, 1 = right corner/canthus)
 * @param {number} v Vertical interpolation [0, 1] (0 = upper lid, 1 = lower lid)
 */
export function evalEyelidFieldPoint(upperPath, lowerPath, u, v) {
  // Upper curve point at u
  const pTop = evalCubicBezier(
    upperPath.p0,
    upperPath.p1,
    upperPath.p2,
    upperPath.p3,
    u
  );

  // Lower curve point at u
  const pBottom = evalCubicBezier(
    lowerPath.p0,
    lowerPath.p1,
    lowerPath.p2,
    lowerPath.p3,
    u
  );

  // Interpolated point across eyelid interior
  return {
    x: lerp(pTop.x, pBottom.x, v),
    y: lerp(pTop.y, pBottom.y, v),
    heightSpan: Math.abs(pBottom.y - pTop.y)
  };
}
