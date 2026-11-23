/**
 * JARVIS — Procedural Web Audio API Synthesizer
 * Generates cinematic ambient sub-drone and subtle ocular blink shutters.
 */

export class AudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.isEnabled = false;
    this.ambientGain = null;
    this.masterGain = null;
    this.oscillators = [];
  }

  init() {
    if (this.audioCtx) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();

      // Master output
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      // Ambient drone chain
      this.ambientGain = this.audioCtx.createGain();
      this.ambientGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

      // Lowpass resonant filter for dark warmth
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(95, this.audioCtx.currentTime);
      filter.Q.setValueAtTime(2.5, this.audioCtx.currentTime);

      // Sub-bass fundamental (44 Hz)
      const oscSub = this.audioCtx.createOscillator();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(44.0, this.audioCtx.currentTime);

      // Warm harmonic (88 Hz with slight detuning for binaural warmth)
      const oscHarmonic = this.audioCtx.createOscillator();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(88.4, this.audioCtx.currentTime);

      // LFO for slow breathing pulsation
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      lfo.frequency.setValueAtTime(0.12, this.audioCtx.currentTime); // 8-second cycle
      lfoGain.gain.setValueAtTime(15, this.audioCtx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      oscSub.connect(filter);
      oscHarmonic.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      oscSub.start();
      oscHarmonic.start();
      lfo.start();

      this.oscillators.push(oscSub, oscHarmonic, lfo);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  toggle() {
    if (!this.audioCtx) {
      this.init();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isEnabled = !this.isEnabled;

    if (this.ambientGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      if (this.isEnabled) {
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.linearRampToValueAtTime(0.24, now + 1.2);
      } else {
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
      }
    }

    return this.isEnabled;
  }

  /**
   * Plays an ultra-subtle pneumatic micro-click on blink closure
   */
  playBlinkSound() {
    if (!this.isEnabled || !this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const now = this.audioCtx.currentTime;

      // Soft white noise burst with rapid decay
      const bufferSize = this.audioCtx.sampleRate * 0.035; // 35ms burst
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = this.audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, now);
      bandpass.Q.setValueAtTime(3.0, now);

      const clickGain = this.audioCtx.createGain();
      clickGain.gain.setValueAtTime(0.06, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      noise.connect(bandpass);
      bandpass.connect(clickGain);
      clickGain.connect(this.masterGain);

      noise.start(now);
    } catch (e) {
      // Ignore audio glitches safely
    }
  }

  ensureContextRunning() {
    if (!this.audioCtx) {
      this.init();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Holographic synthetic carrier chime for JARVIS speech onset
   * Dual pristine frequencies (880Hz & 1760Hz) with fast exponential decay
   */
  playJarvisCarrier() {
    try {
      this.ensureContextRunning();
      if (!this.audioCtx || this.audioCtx.state !== 'running') return;

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(920, now + 0.055);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1760, now);

      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain || this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.07);
      osc2.stop(now + 0.07);
    } catch (e) {}
  }

  /**
   * Deep mechanical resonant sub-harmonic pulse for ULTRON speech onset
   * Low metallic fundamental (55Hz / 110Hz) with deliberate mechanical decay
   */
  playUltronCarrier() {
    try {
      this.ensureContextRunning();
      if (!this.audioCtx || this.audioCtx.state !== 'running') return;

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(110, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.080);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain || this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.085);
      osc2.stop(now + 0.085);
    } catch (e) {}
  }
}
