/**
 * JARVIS — Mathematical Utilities & Animation Easings
 */

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Easing functions for realistic biological motion
export function easeInQuad(t) {
  return t * t;
}

export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeInCubic(t) {
  return t * t * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBack(t, s = 1.4) {
  const c = s + 1;
  return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

// Simple fast pseudo-random number generator for procedural iris fibers
export class SeededPRNG {
  constructor(seed = 1337) {
    this.s = seed % 2147483647;
    if (this.s <= 0) this.s += 2147483646;
  }

  next() {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }
}
