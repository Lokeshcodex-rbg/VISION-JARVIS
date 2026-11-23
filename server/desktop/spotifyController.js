/**
 * VISION AI — Spotify Desktop Music Controller
 * Workstream E: Windows Media Key Transport, Spotify URI Navigation & Playback Verification
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { errorDiagnostics, ErrorCode } = require('../errorDiagnosticsService.js');

const VK_CODES = {
  PLAY_PAUSE: 0xB3,
  NEXT_TRACK: 0xB0,
  PREV_TRACK: 0xB1,
  STOP: 0xB2,
  VOLUME_MUTE: 0xAD,
  VOLUME_DOWN: 0xAE,
  VOLUME_UP: 0xAF
};

class SpotifyController {
  constructor() {
    this.playbackState = {
      isRunning: false,
      isPlaying: false,
      currentTrack: null,
      currentArtist: null,
      windowTitle: '',
      lastVerified: null
    };
  }

  /**
   * Send a virtual media key to Windows
   */
  async sendMediaKey(vkCode) {
    return new Promise((resolve) => {
      const pyCmd = `python -c "import ctypes, time; ctypes.windll.user32.keybd_event(${vkCode}, 0, 0, 0); time.sleep(0.05); ctypes.windll.user32.keybd_event(${vkCode}, 0, 2, 0); print('OK')"` ;
      exec(pyCmd, { timeout: 3000 }, (err, stdout) => {
        resolve(!err && stdout.includes('OK'));
      });
    });
  }

  /**
   * Query running Spotify process and window title to verify playback
   */
  async getStatus() {
    return new Promise((resolve) => {
      const ps = `powershell -NoProfile -Command "Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { [string]::IsNullOrWhiteSpace($_.MainWindowTitle) -eq $false } | Select-Object -First 1 Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress"`;
      exec(ps, { timeout: 3500 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (err || !out) {
          this.playbackState = {
            isRunning: false,
            isPlaying: false,
            currentTrack: null,
            currentArtist: null,
            windowTitle: '',
            lastVerified: new Date().toISOString()
          };
          return resolve(this.playbackState);
        }

        try {
          const proc = JSON.parse(out);
          const title = proc.MainWindowTitle || '';
          const isIdleTitle = !title || title.toLowerCase() === 'spotify' || title.toLowerCase().includes('spotify free') || title.toLowerCase().includes('spotify premium');
          
          let artist = null;
          let track = null;
          let isPlaying = false;

          if (!isIdleTitle && title.includes(' - ')) {
            const parts = title.split(' - ');
            artist = parts[0].trim();
            track = parts.slice(1).join(' - ').trim();
            isPlaying = true;
          }

          this.playbackState = {
            isRunning: true,
            isPlaying,
            currentTrack: track,
            currentArtist: artist,
            windowTitle: title,
            lastVerified: new Date().toISOString()
          };
          resolve(this.playbackState);
        } catch (_) {
          resolve(this.playbackState);
        }
      });
    });
  }

  /**
   * Launch Spotify desktop or navigate to URI
   */
  async launchOrNavigate(uri = '') {
    const targetUri = uri || 'spotify:';
    return new Promise((resolve) => {
      exec(`start ${targetUri}`, { timeout: 4000 }, (err) => {
        if (err) {
          // Fallback to web player
          const webUrl = uri.includes('collection') 
            ? 'https://open.spotify.com/collection/tracks' 
            : (uri.includes('search:') ? `https://open.spotify.com/search/${encodeURIComponent(uri.replace('spotify:search:', ''))}` : 'https://open.spotify.com');
          exec(`start ${webUrl}`);
          resolve({
            success: true,
            mode: 'web_fallback',
            url: webUrl,
            summary: `Opened Spotify Web Player at ${webUrl}, sir.`
          });
        } else {
          resolve({
            success: true,
            mode: 'desktop_protocol',
            uri: targetUri,
            summary: `Dispatched Spotify protocol command (${targetUri}), sir.`
          });
        }
      });
    });
  }

  /**
   * Transport controls: play, pause, next, previous
   */
  async controlPlayback(action = 'play') {
    const act = String(action).toLowerCase().trim();
    let vk = VK_CODES.PLAY_PAUSE;
    if (act === 'next' || act === 'skip') vk = VK_CODES.NEXT_TRACK;
    else if (act === 'previous' || act === 'prev' || act === 'back') vk = VK_CODES.PREV_TRACK;
    else if (act === 'stop') vk = VK_CODES.STOP;

    await this.sendMediaKey(vk);
    // Wait briefly and verify status
    await new Promise(r => setTimeout(r, 600));
    const status = await this.getStatus();

    return {
      success: true,
      action: act,
      status,
      summary: status.isPlaying 
        ? `Spotify is playing: "${status.currentTrack}" by ${status.currentArtist}, sir.`
        : `Dispatched ${act} command to Spotify media transport, sir.`
    };
  }

  /**
   * Play user's Liked Songs
   */
  async playLikedSongs() {
    await this.launchOrNavigate('spotify:collection:tracks');
    await new Promise(r => setTimeout(r, 1200));
    return await this.controlPlayback('play');
  }

  /**
   * Search for an artist, song, or playlist and play
   */
  async searchAndPlay(query = '') {
    if (!query) throw new Error('Search query is required.');
    const safeQ = encodeURIComponent(query.trim());
    await this.launchOrNavigate(`spotify:search:${safeQ}`);
    await new Promise(r => setTimeout(r, 1200));
    return await this.controlPlayback('play');
  }
}

const spotifyControllerInstance = new SpotifyController();

module.exports = {
  SpotifyController,
  spotifyController: spotifyControllerInstance,
  VK_CODES
};
