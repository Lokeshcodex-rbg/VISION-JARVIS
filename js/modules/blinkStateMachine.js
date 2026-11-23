/**
 * JARVIS — Human Biological Blink State Machine
 * Accurately models eyelid acceleration, brief occlusion hold, and deceleration.
 */

import { CONFIG } from '../config.js';
import { randomRange, easeInCubic, easeOutCubic } from '../math/utils.js';

export const BlinkState = {
  IDLE_OPEN: 'IDLE_OPEN',
  CLOSING: 'CLOSING',
  CLOSED_HOLD: 'CLOSED_HOLD',
  OPENING: 'OPENING'
};

export class BlinkStateMachine {
  constructor(onBlinkCloseCallback = null) {
    this.state = BlinkState.IDLE_OPEN;
    this.progress = 0; // 0 = open, 1 = closed
    this.timer = 0;
    this.duration = 0;
    this.onBlinkClose = onBlinkCloseCallback;

    // Double-blink state
    this.isDoubleBlink = false;
    this.pendingDoubleBlink = false;

    // Schedule initial blink
    this.scheduleNextBlink();
  }

  scheduleNextBlink(delay = null) {
    this.state = BlinkState.IDLE_OPEN;
    this.progress = 0;
    this.timer = 0;
    this.duration = delay !== null ? delay : randomRange(CONFIG.blink.minInterval, CONFIG.blink.maxInterval);
  }

  triggerBlink() {
    if (this.state === BlinkState.IDLE_OPEN) {
      this.startClosing();
    }
  }

  startClosing() {
    this.state = BlinkState.CLOSING;
    this.timer = 0;
    // Vary closing speed slightly for human naturalness (75ms - 105ms)
    this.duration = CONFIG.blink.closeDuration * randomRange(0.9, 1.15);
  }

  update(dtMs) {
    this.timer += dtMs;

    switch (this.state) {
      case BlinkState.IDLE_OPEN:
        // Eye is open, counting down until next blink
        this.progress = 0;
        if (this.timer >= this.duration) {
          // Check for human double blink chance
          this.pendingDoubleBlink = Math.random() < CONFIG.blink.doubleBlinkChance;
          this.startClosing();
        }
        break;

      case BlinkState.CLOSING: {
        const t = Math.min(1.0, this.timer / this.duration);
        // Fast organic downward acceleration
        this.progress = easeInCubic(t);

        if (t >= 1.0) {
          this.state = BlinkState.CLOSED_HOLD;
          this.timer = 0;
          this.duration = CONFIG.blink.holdDuration * randomRange(0.85, 1.25);
          this.progress = 1.0;
          
          if (typeof this.onBlinkClose === 'function') {
            this.onBlinkClose();
          }
        }
        break;
      }

      case BlinkState.CLOSED_HOLD:
        // Brief closed pause
        this.progress = 1.0;
        if (this.timer >= this.duration) {
          this.state = BlinkState.OPENING;
          this.timer = 0;
          // Opening takes slightly longer than closing (~140ms - 180ms)
          this.duration = CONFIG.blink.openDuration * randomRange(0.95, 1.2);
        }
        break;

      case BlinkState.OPENING: {
        const t = Math.min(1.0, this.timer / this.duration);
        // Decelerating reopening curve
        this.progress = 1.0 - easeOutCubic(t);

        if (t >= 1.0) {
          this.progress = 0;
          if (this.pendingDoubleBlink) {
            this.pendingDoubleBlink = false;
            // Immediate quick secondary blink after a brief 120ms flutter
            this.scheduleNextBlink(randomRange(110, 160));
          } else {
            this.scheduleNextBlink();
          }
        }
        break;
      }
    }

    return this.progress;
  }
}
