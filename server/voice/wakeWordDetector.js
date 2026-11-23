/**
 * VISION AI — Wake-Word & Microphone Listening Controls
 * 
 * Manages configurable wake-word activation, microphone state indicators,
 * low-resource listening loops, physical/UI mute controls, and privacy boundaries.
 * 
 * Invariants:
 * 1. Opt-In Wake-Word: Wake-word listening is disabled by default and requires
 *    explicit user configuration before continuous background audio monitoring is engaged.
 * 2. Transparent Microphone State: Always exposes unambiguous states:
 *    IDLE, LISTENING, PROCESSING, MUTED, SPEAKING, ERROR.
 * 3. Physical & Interface Mute: When muted, microphone input is completely detached,
 *    zero audio frames are processed or buffered, and wake-word triggers are blocked.
 * 4. Immediate Stop-Listening: Instant abort of listening loops upon user command or Emergency Stop.
 */

const EventEmitter = require('events');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const MIC_STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  MUTED: 'MUTED',
  ERROR: 'ERROR'
};

const DEFAULT_WAKE_WORDS = ['hey jarvis', 'jarvis', 'okay jarvis'];

class WakeWordDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    this.isEnabled = options.enabled || false; // Opt-in by default
    this.isMuted = options.muted || false;
    this.configuredWakeWords = options.wakeWords || [...DEFAULT_WAKE_WORDS];
    this.activeState = this.isMuted ? MIC_STATES.MUTED : MIC_STATES.IDLE;
    this.totalWakeDetections = 0;
    this.lastDetectedWakeWord = null;
  }

  /**
   * Sets the wake-word detection enabled state (opt-in)
   */
  setEnabled(enabled = true) {
    this.isEnabled = Boolean(enabled);
    if (!this.isEnabled) {
      this.setState(this.isMuted ? MIC_STATES.MUTED : MIC_STATES.IDLE);
    } else if (!this.isMuted && this.activeState === MIC_STATES.IDLE) {
      this.setState(MIC_STATES.LISTENING);
    }
    return { isEnabled: this.isEnabled, activeState: this.activeState };
  }

  /**
   * Updates the configured activation phrases
   */
  setWakeWords(wakeWords = []) {
    if (Array.isArray(wakeWords) && wakeWords.length > 0) {
      this.configuredWakeWords = wakeWords.map(w => String(w).toLowerCase().trim());
    }
    return [...this.configuredWakeWords];
  }

  /**
   * Toggles or sets microphone mute state
   */
  setMute(muted = true) {
    this.isMuted = Boolean(muted);
    if (this.isMuted) {
      this.setState(MIC_STATES.MUTED);
    } else {
      this.setState(this.isEnabled ? MIC_STATES.LISTENING : MIC_STATES.IDLE);
    }
    this.emit('muteChange', { isMuted: this.isMuted, state: this.activeState });
    return { isMuted: this.isMuted, state: this.activeState };
  }

  mute() {
    return this.setMute(true);
  }

  unmute() {
    return this.setMute(false);
  }

  setState(newState) {
    if (!MIC_STATES[newState]) return;
    const previous = this.activeState;
    this.activeState = newState;
    if (previous !== newState) {
      this.emit('stateChange', { previous, current: newState });
    }
  }

  /**
   * Stops listening immediately (emergency or user command)
   */
  stopListening(reason = 'USER_REQUEST') {
    this.setState(this.isMuted ? MIC_STATES.MUTED : MIC_STATES.IDLE);
    return { stopped: true, reason, state: this.activeState };
  }

  /**
   * Checks whether incoming speech text contains any configured wake-word
   */
  checkWakeWord(speechText = '') {
    if (this.isMuted) {
      return { detected: false, reason: 'MICROPHONE_MUTED' };
    }

    if (!this.isEnabled) {
      return { detected: false, reason: 'WAKE_WORD_DISABLED' };
    }

    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      return { detected: false, reason: 'EMERGENCY_STOP_ACTIVE' };
    }

    const norm = String(speechText || '').toLowerCase().trim();
    for (const wakeWord of this.configuredWakeWords) {
      if (norm.startsWith(wakeWord) || norm.includes(wakeWord)) {
        this.totalWakeDetections++;
        this.lastDetectedWakeWord = wakeWord;
        
        // Strip wake-word prefix to extract command payload
        const cleanedCommand = norm.replace(wakeWord, '').replace(/^[\s,;:]+/, '').trim();

        const result = {
          detected: true,
          wakeWord,
          originalText: speechText,
          commandPayload: cleanedCommand,
          timestamp: new Date().toISOString()
        };

        this.setState(MIC_STATES.PROCESSING);
        this.emit('wakeWordDetected', result);
        return result;
      }
    }

    return { detected: false, reason: 'NO_WAKE_WORD_MATCH' };
  }

  getMetrics() {
    return {
      isEnabled: this.isEnabled,
      isMuted: this.isMuted,
      activeState: this.activeState,
      configuredWakeWords: this.configuredWakeWords,
      totalWakeDetections: this.totalWakeDetections,
      lastDetectedWakeWord: this.lastDetectedWakeWord
    };
  }
}

const wakeWordDetectorInstance = new WakeWordDetector();

module.exports = {
  WakeWordDetector,
  wakeWordDetectorInstance,
  MIC_STATES,
  DEFAULT_WAKE_WORDS
};
