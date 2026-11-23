/**
 * VISION AI — Video Intelligence Subsystem
 * Implements Phase 11 Section 7: Video Intelligence.
 * Supports local video files and user-provided video streams.
 * Performs scene segmentation, frame extraction, timestamped summaries,
 * and visual event detection without secret background recording.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_BRIDGE = path.join(__dirname, 'python_vision_bridge.py');

class VideoIntelligenceEngine {
  constructor() {
    this.supportedVideoFormats = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];
    this.isRecording = false; // Never background records
  }

  async runBridge(action, args = []) {
    return new Promise((resolve) => {
      execFile('python', [PYTHON_BRIDGE, action, ...args], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          return resolve({ success: false, error: err.message || stderr });
        }
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine);
          resolve(parsed);
        } catch (e) {
          resolve({ success: false, error: 'JSON parse error', raw: stdout });
        }
      });
    });
  }

  /**
   * Analyzes a local video file, extracts keyframes, and produces a timestamped summary
   */
  async analyzeVideo(videoPath, options = {}) {
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: `Video file not found: ${videoPath}` };
    }

    const ext = path.extname(videoPath).toLowerCase();
    if (!this.supportedVideoFormats.includes(ext)) {
      return {
        success: false,
        error: `Unsupported video format "${ext}". Supported: ${this.supportedVideoFormats.join(', ')}`
      };
    }

    const sampleFramesCount = options.maxFrames || 6;
    const bridgeRes = await this.runBridge('process_video', [videoPath, String(sampleFramesCount)]);
    if (!bridgeRes.success) {
      return bridgeRes;
    }

    // Generate timestamped narrative segments with temporal motion & change analysis
    const events = (bridgeRes.frames || []).map((frame, idx) => ({
      index: idx + 1,
      timestampSec: frame.timestampSec,
      timestampFormatted: `${Math.floor(frame.timestampSec / 60)}:${String(Math.floor(frame.timestampSec % 60)).padStart(2, '0')}`,
      framePath: frame.savedPath,
      meanLuminance: frame.meanLuminance ?? null,
      motionDeltaPercent: frame.motionDeltaPercent ?? 0,
      significantChange: Boolean(frame.significantChange),
      observation: idx === 0
        ? `Initial reference frame at ${frame.timestampSec}s (mean luminance: ${frame.meanLuminance ?? 'n/a'}).`
        : (frame.significantChange
            ? `Significant visual transition at ${frame.timestampSec}s (frame-to-frame delta: ${frame.motionDeltaPercent}%).`
            : `Low-motion continuation at ${frame.timestampSec}s (delta: ${frame.motionDeltaPercent ?? 0}%).`)
    }));

    let multimodalComparison = null;
    if (events.length >= 2 && options.deepAnalyze !== false) {
      try {
        const { visionServiceInstance } = require('../visionService.js');
        const changedEvent = events.find(e => e.significantChange) || events[events.length - 1];
        const f1 = fs.readFileSync(events[0].framePath).toString('base64');
        const f2 = fs.readFileSync(changedEvent.framePath).toString('base64');
        const comp = await visionServiceInstance.compareFrames({
          frame1Base64: f1,
          frame2Base64: f2,
          prompt: `Analyze temporal progression between ${events[0].timestampSec}s and ${changedEvent.timestampSec}s of this video.`
        });
        if (comp && comp.success) {
          multimodalComparison = {
            tStartSec: events[0].timestampSec,
            tEndSec: changedEvent.timestampSec,
            provider: comp.provider,
            analysis: comp.analysis
          };
        }
      } catch (_) {}
    }

    const changeTimestamps = events.filter(e => e.significantChange).map(e => `${e.timestampSec}s (${e.motionDeltaPercent}%)`);
    const maxMotionDeltaPercent = events.reduce((m, e) => Math.max(m, Number(e.motionDeltaPercent || 0)), 0);

    return {
      success: true,
      videoPath,
      fileName: path.basename(videoPath),
      durationSec: bridgeRes.durationSec,
      fps: bridgeRes.fps,
      totalFrames: bridgeRes.totalFrames,
      resolution: bridgeRes.resolution,
      keyframesExtracted: events.length,
      temporalEventsCount: bridgeRes.temporalEventsCount || changeTimestamps.length,
      changeTimestamps,
      motionSummary: {
        maxMotionDeltaPercent,
        significantChangeCount: changeTimestamps.length
      },
      multimodalComparison,
      events,
      summary: `Video temporal analysis complete for "${path.basename(videoPath)}": ${bridgeRes.durationSec}s @ ${bridgeRes.fps} FPS (${bridgeRes.resolution[0]}x${bridgeRes.resolution[1]}). Extracted ${events.length} keyframes; detected ${changeTimestamps.length} significant visual transition(s)${changeTimestamps.length > 0 ? ' at ' + changeTimestamps.join(', ') : ''}.${multimodalComparison ? ' Temporal progression: ' + multimodalComparison.analysis : ''}`,
      provenance: {
        analyzedAt: new Date().toISOString(),
        videoPath,
        safeguard: 'Zero background surveillance. File analyzed strictly on demand.'
      }
    };
  }
}

module.exports = {
  VideoIntelligenceEngine,
  videoIntelligenceEngineInstance: new VideoIntelligenceEngine()
};
