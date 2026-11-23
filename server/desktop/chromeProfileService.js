/**
 * VISION AI — Chrome Multi-Profile Intelligence & Gmail Navigation Service
 * Workstream C: Local State Profile Resolution, Multi-Profile Switching & Gmail Routing
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

class ChromeProfileService {
  constructor() {
    this.localStatePath = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Google', 'Chrome', 'User Data', 'Local State'
    );
    this.cachedProfiles = null;
    this.lastReadTime = 0;
    this.activeProfileWindows = new Map();
  }

  getChromeExecutablePath() {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand;
    }
    return 'chrome.exe';
  }

  /**
   * Reads and parses Chrome profiles from Local State
   */
  getProfiles(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cachedProfiles && (now - this.lastReadTime < 30000)) {
      return this.cachedProfiles;
    }

    if (!fs.existsSync(this.localStatePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.localStatePath, 'utf8');
      const data = JSON.parse(raw);
      const infoCache = data.profile?.info_cache || {};

      const profiles = Object.entries(infoCache).map(([dirName, info]) => {
        const name = info.name || dirName;
        const email = info.user_name || '';
        const aliases = [
          dirName.toLowerCase(),
          name.toLowerCase(),
          email.toLowerCase(),
          email.split('@')[0].toLowerCase()
        ];
        if (email.includes('somaiya') || name.toLowerCase().includes('somaiya')) {
          aliases.push('somaiya', 'college', 'university', 'work');
        }
        if (dirName === 'Default' || email.includes('upadhyaylokesh37')) {
          aliases.push('personal', 'primary', 'default', 'main');
        }

        return {
          dir: dirName,
          name,
          email,
          aliases,
          avatarUrl: info.avatar_icon || null,
          isManaged: Boolean(info.is_enterprise_managed)
        };
      });

      this.cachedProfiles = profiles;
      this.lastReadTime = now;
      return profiles;
    } catch (err) {
      console.warn('[CHROME_PROFILE] Failed to read Local State:', err.message);
      return [];
    }
  }

  /**
   * Resolves a query against the live Chrome Local State profile registry with ambiguity & not-found precision.
   * Returns { status: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND', profile?, matches, availableProfiles, code? }.
   */
  resolveProfileDetailed(query = '') {
    const profiles = this.getProfiles(true);
    const availableProfiles = profiles.map(p => ({ dir: p.dir, name: p.name, email: p.email }));
    if (!profiles.length) {
      return {
        status: 'NOT_FOUND',
        code: 'PROFILE_NOT_FOUND',
        requestedProfile: query,
        matches: [],
        availableProfiles
      };
    }

    let q = String(query || '').toLowerCase().trim();
    if (!/^profile\s*\d+$/i.test(q)) {
      q = q
        .replace(/^(?:my|the|for|named|called)\s+/i, '')
        .replace(/\s+(?:google\s+)?chrome(?:\s+profile)?$/i, '')
        .replace(/\s+profile$/i, '')
        .trim();
    }

    if (!q || q === 'default' || q === 'primary' || q === 'personal' || q === 'main') {
      const personal = profiles.find(p => p.aliases.includes('personal')) || profiles.find(p => p.dir === 'Default') || profiles[0];
      return { status: 'RESOLVED', profile: personal, matches: [personal], availableProfiles };
    }

    // Reject purely generic placeholders with no identifying token
    const genericWords = new Set(['chrome', 'google', 'profile', 'browser', 'account', 'user']);
    if (genericWords.has(q)) {
      return {
        status: 'NOT_FOUND',
        code: 'PROFILE_NOT_FOUND',
        requestedProfile: query,
        matches: [],
        availableProfiles
      };
    }

    // Tier 1: Unique exact directory, exact full email, or exact email local-part
    const tier1 = profiles.filter((p) => {
      const dirLow = p.dir.toLowerCase();
      const emailLow = p.email.toLowerCase();
      const localPart = emailLow.includes('@') ? emailLow.split('@')[0] : '';
      return dirLow === q || (emailLow && emailLow === q) || (localPart && localPart === q);
    });
    if (tier1.length === 1) {
      return { status: 'RESOLVED', profile: tier1[0], matches: tier1, availableProfiles };
    }
    if (tier1.length > 1) {
      return {
        status: 'AMBIGUOUS',
        code: 'AMBIGUOUS_PROFILE',
        requestedProfile: query,
        matches: tier1,
        availableProfiles
      };
    }

    // Tier 2: Exact display name or explicit alias (e.g. 'somaiya', 'college', 'laurea', or ambiguous 'lokesh')
    const tier2 = profiles.filter((p) => {
      if (p.name.toLowerCase() === q) return true;
      return (p.aliases || []).some(a => !genericWords.has(a) && a === q);
    });
    if (tier2.length === 1) {
      return { status: 'RESOLVED', profile: tier2[0], matches: tier2, availableProfiles };
    }
    if (tier2.length > 1) {
      return {
        status: 'AMBIGUOUS',
        code: 'AMBIGUOUS_PROFILE',
        requestedProfile: query,
        matches: tier2,
        availableProfiles
      };
    }

    // Tier 3: Prefix or strong substring match on meaningful identifiers (>= 4 chars)
    if (q.length >= 4) {
      const tier3 = profiles.filter((p) => {
        const emailLow = p.email.toLowerCase();
        const nameLow = p.name.toLowerCase();
        const localPart = emailLow.includes('@') ? emailLow.split('@')[0] : '';
        if (nameLow.includes(q) || emailLow.includes(q) || localPart.startsWith(q)) return true;
        return (p.aliases || []).some(a =>
          a !== 'default' && !genericWords.has(a) && a.length >= 4 && (a.startsWith(q) || (q.length >= 5 && a.includes(q)))
        );
      });
      if (tier3.length === 1) {
        return { status: 'RESOLVED', profile: tier3[0], matches: tier3, availableProfiles };
      }
      if (tier3.length > 1) {
        return {
          status: 'AMBIGUOUS',
          code: 'AMBIGUOUS_PROFILE',
          requestedProfile: query,
          matches: tier3,
          availableProfiles
        };
      }
    }

    return {
      status: 'NOT_FOUND',
      code: 'PROFILE_NOT_FOUND',
      requestedProfile: query,
      matches: [],
      availableProfiles
    };
  }

  /**
   * Resolves a query (e.g. 'Somaiya', 'personal', 'Profile 1', 'workspace') to a unique profile or null.
   */
  resolveProfile(query = '') {
    const res = this.resolveProfileDetailed(query);
    return res.status === 'RESOLVED' ? res.profile : null;
  }

  /**
   * Launches Google Chrome with the requested profile and target URL (or reuses verified window cleanly).
   */
  async launchProfile(profileQuery = '', targetUrl = '') {
    const resolution = this.resolveProfileDetailed(profileQuery);
    const availableFormatted = resolution.availableProfiles
      .map(p => `${p.name} (${p.email || p.dir})`)
      .join(', ');

    if (resolution.status === 'NOT_FOUND') {
      return {
        success: false,
        verified: false,
        code: 'PROFILE_NOT_FOUND',
        errorCode: 'PROFILE_NOT_FOUND',
        action: 'profile_not_found',
        requestedProfile: profileQuery,
        availableProfiles: resolution.availableProfiles,
        matchingProfiles: [],
        error: `Unable to resolve Chrome profile matching "${profileQuery}". Available profiles: ${availableFormatted}`,
        summary: `Unable to open Chrome profile "${profileQuery}", sir (PROFILE_NOT_FOUND). Available profiles: ${availableFormatted}.`
      };
    }

    if (resolution.status === 'AMBIGUOUS') {
      const matchFormatted = resolution.matches
        .map(p => `${p.name} [${p.dir}${p.email ? ' - ' + p.email : ''}]`)
        .join(', ');
      return {
        success: false,
        verified: false,
        code: 'AMBIGUOUS_PROFILE',
        errorCode: 'AMBIGUOUS_PROFILE',
        action: 'ambiguous_profile',
        requestedProfile: profileQuery,
        matchingProfiles: resolution.matches.map(p => ({ dir: p.dir, name: p.name, email: p.email })),
        availableProfiles: resolution.availableProfiles,
        error: `Multiple Chrome profiles match "${profileQuery}": ${matchFormatted}. Please specify which profile email or directory to open.`,
        summary: `Unable to resolve "${profileQuery}" uniquely — multiple matching Chrome profiles found: ${matchFormatted}. Please specify which one to open, sir.`
      };
    }

    const profile = resolution.profile;
    const { execFile } = require('child_process');
    const win32Launcher = path.join(__dirname, 'win32_app_launcher.py');

    // Duplicate-instance prevention: if this profile already has a live Chrome window and no specific new URL is requested, focus it cleanly
    const tracked = this.activeProfileWindows.get(profile.dir);
    if (tracked && tracked.hwnd && (!targetUrl || !String(targetUrl).trim())) {
      const reuseResult = await new Promise((resolve) => {
        execFile('python', [win32Launcher, 'focus_hwnd', String(tracked.hwnd)], { timeout: 6000 }, (err, stdout) => {
          if (!err && stdout && stdout.trim()) {
            try {
              const lines = stdout.trim().split('\n').filter(Boolean);
              const parsed = JSON.parse(lines[lines.length - 1] || '{}');
              if (parsed && parsed.success && String(parsed.proc || '').includes('chrome')) {
                return resolve(parsed);
              }
            } catch (_) {}
          }
          resolve(null);
        });
      });

      if (reuseResult) {
        return {
          success: true,
          verified: true,
          reusedExisting: true,
          action: 'already_running',
          hwnd: reuseResult.hwnd,
          pid: reuseResult.pid,
          windowTitle: reuseResult.windowTitle || tracked.windowTitle || '',
          profile: {
            name: profile.name,
            dir: profile.dir,
            email: profile.email
          },
          targetUrl: 'Existing Window',
          summary: `Chrome profile "${profile.name}" (${profile.email || profile.dir}) is already open; brought existing window to the foreground (PID ${reuseResult.pid}, HWND ${reuseResult.hwnd}), sir.`
        };
      }
      this.activeProfileWindows.delete(profile.dir);
    }

    // Quote --profile-directory properly for Windows CreateProcessW
    const argTokens = [`"--profile-directory=${profile.dir}"`];
    if (targetUrl && typeof targetUrl === 'string' && targetUrl.trim()) {
      argTokens.push(`"${targetUrl.trim()}"`);
    }
    const argStr = argTokens.join(' ');

    return new Promise((resolve) => {
      execFile('python', [win32Launcher, 'launch', 'Google Chrome', '--args', argStr], { timeout: 15000 }, (err, stdout, stderr) => {
        if (err) {
          return resolve({
            success: false,
            verified: false,
            code: 'CHROME_LAUNCH_FAILED',
            profile: { name: profile.name, dir: profile.dir, email: profile.email },
            error: `Failed to launch Chrome profile "${profile.name}": ${err.message || stderr}`,
            summary: `Unable to open Chrome profile "${profile.name}", sir: ${err.message || stderr}`
          });
        }
        let launcherResult = null;
        try {
          const lines = (stdout || '').trim().split('\n').filter(Boolean);
          launcherResult = JSON.parse(lines[lines.length - 1] || '{}');
        } catch (_) {}

        if (!launcherResult || !launcherResult.success || !launcherResult.verified) {
          const reason = (launcherResult && (launcherResult.error || launcherResult.summary)) ||
            `Chrome launch command finished for profile "${profile.name}" but no visible Chrome window was verified.`;
          return resolve({
            success: false,
            verified: false,
            code: 'WINDOW_VERIFICATION_FAILED',
            profile: { name: profile.name, dir: profile.dir, email: profile.email },
            error: reason,
            summary: `Unable to verify Chrome window for profile "${profile.name}", sir: ${reason}`
          });
        }

        if (launcherResult.hwnd) {
          this.activeProfileWindows.set(profile.dir, {
            hwnd: launcherResult.hwnd,
            pid: launcherResult.pid || null,
            windowTitle: launcherResult.windowTitle || ''
          });
        }

        resolve({
          success: true,
          verified: true,
          action: launcherResult.action || 'launched',
          hwnd: launcherResult.hwnd || null,
          pid: launcherResult.pid || null,
          windowTitle: launcherResult.windowTitle || '',
          profile: {
            name: profile.name,
            dir: profile.dir,
            email: profile.email
          },
          targetUrl: targetUrl || 'New Tab',
          summary: `Verified Chrome window open in "${profile.name}" profile (${profile.email || profile.dir})${targetUrl ? ' navigating to ' + targetUrl : ''} (PID ${launcherResult.pid}, HWND ${launcherResult.hwnd}), sir.`
        });
      });
    });
  }

  /**
   * Quick navigation to Gmail in the requested profile
   */
  async openGmail(profileQuery = '', searchFilter = '') {
    let url = 'https://mail.google.com';
    if (searchFilter && typeof searchFilter === 'string' && searchFilter.trim()) {
      url = `https://mail.google.com/mail/#search/${encodeURIComponent(searchFilter.trim())}`;
    }

    const res = await this.launchProfile(profileQuery || 'default', url);
    if (!res || res.success === false) {
      return res;
    }
    return {
      ...res,
      action: 'open_gmail',
      searchFilter: searchFilter || null,
      summary: `Opened Gmail in ${res.profile.name} profile${searchFilter ? ' filtering for "' + searchFilter + '"' : ''} (PID ${res.pid}, HWND ${res.hwnd}), sir.`
    };
  }

  /**
   * End-to-end YouTube automation:
   * 1. Queries live YouTube search results (via Playwright DOM or ytInitialData HTTP fallback)
   * 2. Extracts actual video titles, channels, durations, and watch URLs
   * 3. Selects requested Nth video (1-based index, e.g. 3rd video)
   * 4. Opens the verified /watch?v=... URL in real Google Chrome (with optional profile)
   */
  async openYouTubeAndPlayResult({ query, index = 1, profile = '', openInChrome = true } = {}) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      return { success: false, verified: false, error: 'YouTube search query is required.', summary: 'What should I search for on YouTube, sir?' };
    }
    const targetIdx = Math.max(1, parseInt(index, 10) || 1);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    let videos = [];
    let extractionMethod = 'none';

    // Strategy 1: Live YouTube HTML + ytInitialData extraction (fast, zero-blocking, real live YouTube search results)
    try {
      const resp = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(12000)
      });
      if (resp.ok) {
        const html = await resp.text();
        const match = html.match(/var\s+ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
        if (match && match[1]) {
          const initialData = JSON.parse(match[1]);
          const sections = initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          for (const sec of sections) {
            const items = sec?.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const vr = item.videoRenderer;
              if (vr && vr.videoId) {
                const title = vr.title?.runs?.map(r => r.text).join('') || vr.title?.simpleText || `Video ${videos.length + 1}`;
                const channel = vr.ownerText?.runs?.[0]?.text || 'YouTube Channel';
                const duration = vr.lengthText?.simpleText || 'Live/Video';
                videos.push({
                  index: videos.length + 1,
                  videoId: vr.videoId,
                  title,
                  channel,
                  duration,
                  url: `https://www.youtube.com/watch?v=${vr.videoId}`
                });
              }
            }
          }
          if (videos.length > 0) extractionMethod = 'live_youtube_initial_data';
        }
      }
    } catch (_) {}

    // Strategy 2: Playwright browser DOM fallback if initial HTML fetch didn't extract video renderers
    if (videos.length === 0) {
      let session = null;
      try {
        const { browserAutomationEngineInstance } = require('../browser/browserAutomationEngine.js');
        session = await browserAutomationEngineInstance.openPage(searchUrl, { timeoutMs: 18000 });
        if (session && session.sessionId) {
          const entry = browserAutomationEngineInstance.sessions.get(session.sessionId);
          if (entry && entry.page) {
            await entry.page.waitForSelector('ytd-video-renderer a#video-title', { timeout: 10000 }).catch(() => {});
            const domVideos = await entry.page.evaluate(() => {
              const renderers = Array.from(document.querySelectorAll('ytd-video-renderer'));
              const out = [];
              for (const r of renderers) {
                const a = r.querySelector('a#video-title');
                if (!a) continue;
                const href = a.getAttribute('href') || '';
                if (!href.includes('/watch?v=')) continue;
                const vIdMatch = href.match(/v=([a-zA-Z0-9_-]{6,})/);
                const ch = r.querySelector('#channel-name a, ytd-channel-name a')?.textContent?.trim() || 'YouTube Channel';
                const dur = r.querySelector('span.ytd-thumbnail-overlay-time-status-renderer')?.textContent?.trim() || '';
                out.push({
                  index: out.length + 1,
                  videoId: vIdMatch ? vIdMatch[1] : '',
                  title: (a.textContent || a.getAttribute('title') || '').trim(),
                  channel: ch,
                  duration: dur,
                  url: href.startsWith('http') ? href : `https://www.youtube.com${href.split('&')[0]}`
                });
              }
              return out;
            });
            if (Array.isArray(domVideos) && domVideos.length > 0) {
              videos = domVideos;
              extractionMethod = 'playwright_dom';
            }
          }
        }
      } catch (_) {
      } finally {
        if (session && session.sessionId) {
          try {
            const { browserAutomationEngineInstance } = require('../browser/browserAutomationEngine.js');
            await browserAutomationEngineInstance.closeSession(session.sessionId);
          } catch (_) {}
        }
      }
    }

    if (videos.length === 0) {
      return {
        success: false,
        verified: false,
        query: cleanQuery,
        searchUrl,
        error: 'No YouTube video results could be extracted.',
        summary: `I searched YouTube for "${cleanQuery}", but could not extract video results from the search page right now, sir.`
      };
    }

    if (targetIdx > videos.length) {
      return {
        success: false,
        verified: false,
        query: cleanQuery,
        searchUrl,
        resultsCount: videos.length,
        results: videos.slice(0, 8),
        error: `Requested video #${targetIdx}, but only ${videos.length} result(s) were returned.`,
        summary: `YouTube returned ${videos.length} video result(s) for "${cleanQuery}", so video #${targetIdx} was unavailable. Top results: ${videos.slice(0, 3).map(v => `${v.index}. ${v.title}`).join('; ')}.`
      };
    }

    const selectedVideo = videos[targetIdx - 1];
    let browserLaunch = null;
    if (openInChrome) {
      const targetProfile = profile || 'default';
      const profRes = await this.launchProfile(targetProfile, selectedVideo.url);
      if (profRes && profRes.success && profRes.verified) {
        browserLaunch = profRes;
      } else {
        // Fallback direct Chrome launch without requiring a named profile
        const { appLauncherInstance } = require('./appLauncher.js');
        const chromeExe = this.getChromeExecutablePath();
        const { spawn } = require('child_process');
        try {
          const child = spawn(chromeExe, [selectedVideo.url], { detached: true, stdio: 'ignore' });
          child.unref();
          browserLaunch = { success: true, verified: true, pid: child.pid, url: selectedVideo.url, summary: `Opened Chrome to "${selectedVideo.title}" (${selectedVideo.url})` };
        } catch (err) {
          browserLaunch = { success: false, verified: false, error: err.message };
        }
      }
    }

    const verifiedLoaded = !openInChrome || Boolean(browserLaunch && browserLaunch.verified);
    return {
      success: verifiedLoaded,
      verified: verifiedLoaded,
      action: 'youtube_search_and_open',
      extractionMethod,
      query: cleanQuery,
      searchUrl,
      selectedIndex: targetIdx,
      selectedVideo,
      resultsCount: videos.length,
      results: videos.slice(0, 8),
      browserLaunch,
      summary: openInChrome
        ? `Searched YouTube for "${cleanQuery}" (${videos.length} results via ${extractionMethod}), opened video #${targetIdx} ("${selectedVideo.title}" by ${selectedVideo.channel}) in Google Chrome (${selectedVideo.url}), sir.`
        : `Found ${videos.length} YouTube video results for "${cleanQuery}". Result #${targetIdx}: "${selectedVideo.title}" (${selectedVideo.url}).`
    };
  }
}

const chromeProfileServiceInstance = new ChromeProfileService();

module.exports = {
  ChromeProfileService,
  chromeProfileService: chromeProfileServiceInstance
};
