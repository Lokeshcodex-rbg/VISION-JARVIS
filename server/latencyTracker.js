/**
 * VISION AI — Request Lifecycle Latency Instrumentation & Telemetry
 * Measures exact timestamps across the entire pipeline:
 * - End of user speech (tSpeechEnd)
 * - Transcription availability (tTranscribed)
 * - Client request submission (tReqSubmitted)
 * - Server received request (tReqReceived)
 * - Tool execution start and completion (tToolStart, tToolEnd)
 * - First model response token (tFirstToken)
 * - First caption update (tFirstCaption)
 * - First coherent sentence formed (tFirstSentence)
 * - First audible response (tFirstAudioPlayed)
 * - Total turn duration (totalTurnDurationMs)
 * - Cancellation request & acknowledgement (tCancelRequest, tCancelAck, cancelAckLatencyMs)
 *
 * Stores rolling statistics (median, P95, mean, min, max) without logging
 * raw audio, secrets, or private conversational content.
 * Clearly distinguishes local measurements, provider latency, and simulated tests.
 */

const { performance } = require('perf_hooks');

class LatencyTracker {
  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory;
    this.history = [];
    this.totalRequests = 0;
  }

  /**
   * Records a phase duration or timing object
   */
  recordPhase(phaseName, durationOrTimings = 0) {
    if (typeof durationOrTimings === 'object' && durationOrTimings !== null) {
      return this.record(durationOrTimings);
    }
    const duration = Number(durationOrTimings) || 0;
    return this.record({
      phase: phaseName,
      durationMs: duration,
      totalTurnDurationMs: duration
    });
  }

  /**
   * Records a completed request lifecycle timing entry
   * @param {object} timings
   */
  record(timings = {}) {
    const now = performance.now();
    const isSimulation = Boolean(timings.isSimulation);

    // Compute derived phase latencies safely
    const speechFinalizeMs = (timings.tTranscribed && timings.tSpeechEnd)
      ? Math.max(0, Math.round(timings.tTranscribed - timings.tSpeechEnd))
      : null;

    const clientDispatchMs = (timings.tReqSubmitted && timings.tTranscribed)
      ? Math.max(0, Math.round(timings.tReqSubmitted - timings.tTranscribed))
      : null;

    const toolExecMs = (timings.tToolEnd && timings.tToolStart)
      ? Math.max(0, Math.round(timings.tToolEnd - timings.tToolStart))
      : null;

    const ttftMs = (timings.tFirstToken && timings.tReqReceived)
      ? Math.max(0, Math.round(timings.tFirstToken - timings.tReqReceived))
      : (timings.ttftMs !== undefined ? timings.ttftMs : null);

    const firstCaptionMs = timings.tFirstCaption
      ? Math.max(0, Math.round(timings.tFirstCaption - (timings.tSpeechEnd || timings.tReqSubmitted || timings.tReqReceived || now)))
      : (timings.firstCaptionMs !== undefined ? timings.firstCaptionMs : null);

    const ttfsMs = (timings.tFirstSentence && timings.tReqReceived)
      ? Math.max(0, Math.round(timings.tFirstSentence - timings.tReqReceived))
      : (timings.ttfsMs !== undefined ? timings.ttfsMs : null);

    const voiceToEarMs = (timings.tFirstAudioPlayed && timings.tSpeechEnd)
      ? Math.max(0, Math.round(timings.tFirstAudioPlayed - timings.tSpeechEnd))
      : (timings.voiceToEarMs !== undefined ? timings.voiceToEarMs : null);

    const cancelAckLatencyMs = (timings.tCancelAck && timings.tCancelRequest)
      ? Math.max(0, Math.round(timings.tCancelAck - timings.tCancelRequest))
      : (timings.cancelAckLatencyMs !== undefined ? timings.cancelAckLatencyMs : null);

    const totalTurnDurationMs = (timings.tFullCompleted && timings.tSpeechEnd)
      ? Math.max(0, Math.round(timings.tFullCompleted - timings.tSpeechEnd))
      : (timings.totalMs !== undefined ? timings.totalMs : Math.max(0, Math.round((timings.tFullCompleted || now) - (timings.tReqReceived || now))));

    const entry = {
      id: 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      personality: timings.personality || 'JARVIS',
      provider: timings.provider || 'unknown',
      tier: timings.tier || 'standard',
      toolName: timings.toolName || null,
      isSimulation,

      // Raw Timestamps
      tSpeechEnd: timings.tSpeechEnd || null,
      tTranscribed: timings.tTranscribed || null,
      tReqSubmitted: timings.tReqSubmitted || null,
      tReqReceived: timings.tReqReceived || now,
      tToolStart: timings.tToolStart || null,
      tToolEnd: timings.tToolEnd || null,
      tFirstToken: timings.tFirstToken || null,
      tFirstCaption: timings.tFirstCaption || null,
      tFirstSentence: timings.tFirstSentence || null,
      tFirstAudioPlayed: timings.tFirstAudioPlayed || null,
      tFullCompleted: timings.tFullCompleted || now,
      tCancelRequest: timings.tCancelRequest || null,
      tCancelAck: timings.tCancelAck || null,

      // Calculated Phase Latencies (ms)
      speechFinalizeMs,
      clientDispatchMs,
      toolExecMs,
      ttftMs,
      firstCaptionMs,
      ttfsMs,
      voiceToEarMs,
      cancelAckLatencyMs,
      totalTurnDurationMs,
      totalServerMs: Math.max(0, Math.round((timings.tFullCompleted || now) - (timings.tReqReceived || now)))
    };

    this.history.unshift(entry);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
    this.totalRequests++;

    return entry;
  }

  /**
   * Helper calculation for median, p95, mean, min, max
   */
  _calc(arr) {
    const valid = arr.filter(n => typeof n === 'number' && !isNaN(n) && n >= 0).sort((a, b) => a - b);
    if (valid.length === 0) return { median: null, p95: null, mean: null, min: null, max: null, count: 0 };
    const mid = Math.floor(valid.length / 2);
    const median = valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
    const p95Index = Math.min(valid.length - 1, Math.floor(valid.length * 0.95));
    const p95 = valid[p95Index];
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    return {
      median: Math.round(median),
      p95: Math.round(p95),
      mean: Math.round(mean),
      min: Math.round(valid[0]),
      max: Math.round(valid[valid.length - 1]),
      count: valid.length
    };
  }

  /**
   * Calculates statistical metrics over recent history, splitting real vs simulation
   */
  getStats(filterSimulation = null) {
    let entries = this.history;
    if (filterSimulation === true) {
      entries = entries.filter(e => e.isSimulation === true);
    } else if (filterSimulation === false) {
      entries = entries.filter(e => e.isSimulation !== true);
    }

    return {
      totalRequests: this.totalRequests,
      sampleSize: entries.length,
      speechFinalize: this._calc(entries.map(h => h.speechFinalizeMs)),
      clientDispatch: this._calc(entries.map(h => h.clientDispatchMs)),
      toolExec: this._calc(entries.map(h => h.toolExecMs)),
      ttft: this._calc(entries.map(h => h.ttftMs)),
      firstCaption: this._calc(entries.map(h => h.firstCaptionMs)),
      ttfs: this._calc(entries.map(h => h.ttfsMs)),
      voiceToEar: this._calc(entries.map(h => h.voiceToEarMs)),
      cancelAck: this._calc(entries.map(h => h.cancelAckLatencyMs)),
      totalTurnDuration: this._calc(entries.map(h => h.totalTurnDurationMs)),
      totalServer: this._calc(entries.map(h => h.totalServerMs)),
      lastEntry: entries[0] || null
    };
  }

  /**
   * Generates a concise diagnostic report string and structured summary
   */
  getDiagnosticReport() {
    const realStats = this.getStats(false);
    const simStats = this.getStats(true);

    const fmt = (stat) => {
      if (!stat || stat.count === 0 || stat.median === null) return 'N/A';
      return `med: ${stat.median}ms, p95: ${stat.p95}ms (n=${stat.count})`;
    };

    const lines = [
      '================================================================',
      'VISION AI — PIPELINE LATENCY & PERFORMANCE DIAGNOSTIC REPORT',
      '================================================================',
      `Timestamp: ${new Date().toISOString()}`,
      `Total Recorded Events: ${this.totalRequests} | Current Buffer: ${this.history.length}`,
      '',
      '--- PRODUCTION / LIVE LOCAL & PROVIDER SAMPLES (n=' + realStats.sampleSize + ') ---',
      `• Speech Endpoint -> Transcription:    ${fmt(realStats.speechFinalize)}`,
      `• Client Dispatch -> Server Receive:    ${fmt(realStats.clientDispatch)}`,
      `• Tool Execution Duration:              ${fmt(realStats.toolExec)}`,
      `• First Model Token (TTFT):             ${fmt(realStats.ttft)}`,
      `• First Caption Update:                 ${fmt(realStats.firstCaption)}`,
      `• First Coherent Sentence (TTFS):       ${fmt(realStats.ttfs)}`,
      `• Voice-To-Ear (Speech End -> Audio):   ${fmt(realStats.voiceToEar)}`,
      `• Cancellation Request -> Ack:          ${fmt(realStats.cancelAck)}`,
      `• Total Conversation Turn Duration:     ${fmt(realStats.totalTurnDuration)}`,
      '',
      '--- BENCHMARK / SIMULATION SAMPLES (n=' + simStats.sampleSize + ') ---',
      `• Simulated First Model Token:          ${fmt(simStats.ttft)}`,
      `• Simulated First Caption Update:       ${fmt(simStats.firstCaption)}`,
      `• Simulated Voice-To-Ear:               ${fmt(simStats.voiceToEar)}`,
      `• Simulated Cancellation Latency:       ${fmt(simStats.cancelAck)}`,
      `• Simulated Total Turn Duration:        ${fmt(simStats.totalTurnDuration)}`,
      '================================================================'
    ];

    return {
      reportText: lines.join('\n'),
      realStats,
      simStats,
      timestamp: Date.now()
    };
  }

  generateReport() {
    return this.getDiagnosticReport();
  }

  /**
   * Returns recent non-sensitive performance history
   */
  getHistory(limit = 20) {
    return this.history.slice(0, limit);
  }

  clear() {
    this.history = [];
    this.totalRequests = 0;
  }
}

const latencyTrackerInstance = new LatencyTracker();

module.exports = {
  LatencyTracker,
  latencyTrackerInstance
};
