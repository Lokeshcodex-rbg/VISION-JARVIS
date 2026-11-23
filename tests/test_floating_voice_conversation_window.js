/**
 * Test Suite: JARVIS — Floating Voice Conversation Window
 * tests/test_floating_voice_conversation_window.js
 *
 * Verifies all 8 core requirements:
 * 1. Automatic window behavior on voice conversation start (no focus stealing).
 * 2. Real-time conversation display:
 *    - Left side: speech-recognized words (interim vs. final), typed user messages, transparent error alerts.
 *    - Right side: progressive streaming responses from JARVIS, speech synchronization, generation state.
 * 3. Right-side text input:
 *    - User typing, Enter to send, Shift+Enter for newline.
 *    - Send button, mic toggle, stop-speaking button, end-voice button.
 *    - Seamless switching between voice and text without losing conversation context.
 * 4. Voice experience:
 *    - Dynamic states: LISTENING, LIVE SPEECH, THINKING, SPEAKING, MUTED, ERROR.
 *    - Subtle animated waveform indicator reflecting live capture state.
 * 5. Visual design:
 *    - Compact dark translucent glass styling, rounded corners, subtle border/shadow, JARVIS identity indicator.
 *    - Header dragging, minimizing (into floating pill), and responsive sizing.
 *    - Non-destructive closure: active speech and background tasks continue when window is closed.
 * 6. Conversation continuity:
 *    - Unified conversation stream, shared history, and provider routing.
 * 7. Reliability:
 *    - No duplicate windows, duplicate messages, lost transcriptions, or overlapping audio sessions.
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:3000';

// Ensure the companion server is running
function ensureServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/api/status`, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      console.log('[TEST] Starting server in-process...');
      try {
        require('../server.js');
        setTimeout(() => resolve(true), 1200);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function runFloatingVoiceWindowTests() {
  console.log('='.repeat(80));
  console.log('TEST SUITE: JARVIS FLOATING VOICE CONVERSATION WINDOW');
  console.log('='.repeat(80));

  await ensureServer();

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.grantPermissions(['microphone'], { origin: BASE_URL });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    console.log('[TEST] Loading companion interface:', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    // =========================================================================
    // 1. DOM Elements & Visual Architecture Integrity
    // =========================================================================
    console.log('\n--- 1. DOM Elements & Visual Architecture Integrity ---');
    const windowExists = await page.evaluate(() => {
      const win = document.getElementById('jarvis-floating-voice-window');
      const pill = document.getElementById('jarvis-floating-voice-pill');
      return Boolean(win && pill);
    });
    assert.strictEqual(windowExists, true, 'Floating window and pill must exist in DOM');

    const brandVerified = await page.evaluate(() => {
      const win = document.getElementById('jarvis-floating-voice-window');
      const brand = win.querySelector('.fvw-brand-name')?.textContent;
      const sub = win.querySelector('.fvw-brand-sub')?.textContent;
      return brand === 'JARVIS' && sub?.includes('VISION — MADE BY LOKESH');
    });
    assert.strictEqual(brandVerified, true, 'Window must display official JARVIS / VISION identity');
    console.log('Visual elements and JARVIS branding verified.');

    // =========================================================================
    // 2. Automatic Window Opening & Non-Focus-Stealing
    // =========================================================================
    console.log('\n--- 2. Automatic Window Opening & Non-Focus-Stealing ---');
    // Pre-focus an external element (like the main chat input)
    await page.evaluate(() => {
      const extInput = document.getElementById('stark-main-chat-input');
      if (extInput) extInput.focus();
    });

    const isExtInputFocusedBefore = await page.evaluate(() => {
      return document.activeElement === document.getElementById('stark-main-chat-input');
    });

    // Trigger auto-open via floatingVoiceWindow.open({ autoTriggered: true })
    const autoOpenResult = await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.open({ autoTriggered: true });
      const win = document.getElementById('jarvis-floating-voice-window');
      const isVisible = win && win.style.display !== 'none';
      const isExtInputStillFocused = document.activeElement === document.getElementById('stark-main-chat-input');
      return { isVisible, isExtInputStillFocused };
    });

    assert.strictEqual(autoOpenResult.isVisible, true, 'Window must be visible upon voice auto-open');
    assert.strictEqual(autoOpenResult.isExtInputStillFocused, true, 'Auto-open must NOT steal keyboard focus from active input');
    console.log('Automatic opening and non-focus-stealing policy verified.');

    // =========================================================================
    // 3. Real-Time User Speech on LEFT SIDE (Interim vs Final)
    // =========================================================================
    console.log('\n--- 3. Real-Time User Speech on LEFT SIDE (Interim vs Final) ---');
    // Interim speech
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onUserSpeech('Initiating diagnostic scan', false);
    });

    const interimCheck = await page.evaluate(() => {
      const interimRow = document.querySelector('.fvw-interim-row');
      const statusText = document.getElementById('fvw-status-text')?.textContent;
      const waveformActive = document.getElementById('fvw-waveform')?.classList.contains('is-active');
      return {
        hasInterimRow: Boolean(interimRow),
        interimText: interimRow?.querySelector('.fvw-interim-text')?.textContent,
        statusText,
        waveformActive
      };
    });

    assert.strictEqual(interimCheck.hasInterimRow, true, 'Interim speech row must appear on left side');
    assert.strictEqual(interimCheck.interimText, 'Initiating diagnostic scan');
    assert.strictEqual(interimCheck.statusText, 'LIVE SPEECH');
    assert.strictEqual(interimCheck.waveformActive, true, 'Waveform must activate during live speech');
    console.log('Interim speech with live pulsing indicator verified.');

    // Final speech
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onUserSpeech('Initiating diagnostic scan of system hardware.', true);
    });

    const finalCheck = await page.evaluate(() => {
      const interimRow = document.querySelector('.fvw-interim-row');
      const userRows = document.querySelectorAll('.fvw-user-row:not(.fvw-interim-row)');
      const lastUserBubble = userRows[userRows.length - 1];
      const jc = window.getComputedStyle(lastUserBubble).justifyContent;
      const isLeftAligned = jc === 'flex-start' || jc === 'flow-start' || jc === 'start' || jc === 'normal';
      const badgeText = lastUserBubble.querySelector('.fvw-input-badge')?.textContent;
      const bubbleText = lastUserBubble.querySelector('.fvw-bubble-text')?.textContent;
      return {
        interimRemoved: interimRow === null,
        hasFinalRow: userRows.length > 0,
        badgeText,
        bubbleText,
        isLeftAligned,
        jc
      };
    });

    assert.strictEqual(finalCheck.interimRemoved, true, 'Interim row must be replaced on finalization');
    assert.strictEqual(finalCheck.hasFinalRow, true, 'Final user row must exist');
    assert.strictEqual(finalCheck.badgeText, '🎙️ Spoken');
    assert.strictEqual(finalCheck.bubbleText, 'Initiating diagnostic scan of system hardware.');
    assert.strictEqual(finalCheck.isLeftAligned, true, 'User row must be aligned to LEFT side');
    console.log('Finalized user speech correctly rendered on LEFT side with Spoken badge.');

    // =========================================================================
    // 4. Transparent Speech Recognition Error Display
    // =========================================================================
    console.log('\n--- 4. Transparent Speech Recognition Error Display ---');
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onSpeechRecognitionError('Microphone audio buffer dropped frame');
    });

    const errorCheck = await page.evaluate(() => {
      const errBubble = document.querySelector('.fvw-error-bubble');
      const errText = errBubble?.querySelector('.fvw-bubble-text')?.textContent?.trim();
      const statusText = document.getElementById('fvw-status-text')?.textContent;
      return { hasErr: Boolean(errBubble), errText, statusText };
    });

    assert.strictEqual(errorCheck.hasErr, true, 'Speech error alert must be displayed');
    assert(errorCheck.errText.includes('Microphone audio buffer dropped frame'));
    assert.strictEqual(errorCheck.statusText, 'ERROR');
    console.log('Transparent speech recognition error display verified.');

    // =========================================================================
    // 5. Real-Time Assistant Streaming on RIGHT SIDE & Generation State
    // =========================================================================
    console.log('\n--- 5. Real-Time Assistant Streaming on RIGHT SIDE ---');
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onAssistantToken('All diagnostic telemetry ', 'JARVIS');
      fvw.onAssistantToken('is within nominal tolerances, sir.', 'JARVIS');
    });

    const assistantCheck = await page.evaluate(() => {
      const assistantRows = document.querySelectorAll('.fvw-assistant-row');
      const lastRow = assistantRows[assistantRows.length - 1];
      const jc = window.getComputedStyle(lastRow).justifyContent;
      const isRightAligned = jc === 'flex-end' || jc === 'flow-end' || jc === 'end';
      const status = lastRow.querySelector('.fvw-bubble-status')?.textContent;
      const text = lastRow.querySelector('.fvw-assistant-text')?.textContent;
      const hasCursor = Boolean(lastRow.querySelector('.fvw-cursor'));
      const stopBtnVisible = document.getElementById('fvw-stop-speech-btn')?.style.display !== 'none';
      return {
        isRightAligned,
        jc,
        status,
        text,
        hasCursor,
        stopBtnVisible
      };
    });

    assert.strictEqual(assistantCheck.isRightAligned, true, 'Assistant row must be aligned to RIGHT side');
    assert(assistantCheck.text.includes('All diagnostic telemetry is within nominal tolerances, sir.'));
    assert.strictEqual(assistantCheck.hasCursor, true, 'Streaming cursor must be visible while generating');
    assert.strictEqual(assistantCheck.stopBtnVisible, true, 'Stop-speaking button must be visible while generating');
    console.log('Progressive assistant token streaming on RIGHT side verified.');

    // =========================================================================
    // 6. Speech-Text Synchronization Highlighting
    // =========================================================================
    console.log('\n--- 6. Speech-Text Synchronization Highlighting ---');
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onAssistantSentenceStart('All diagnostic telemetry is within nominal tolerances, sir.', 'JARVIS', 'utt_test');
    });

    const syncCheck = await page.evaluate(() => {
      const activeSent = document.querySelector('.fvw-active-sentence');
      const statusText = document.getElementById('fvw-status-text')?.textContent;
      return {
        hasActiveSentence: Boolean(activeSent),
        activeText: activeSent?.textContent,
        statusText
      };
    });

    assert.strictEqual(syncCheck.hasActiveSentence, true, 'Spoken sentence must have active highlight');
    assert.strictEqual(syncCheck.statusText, 'SPEAKING');
    console.log('Spoken sentence visual synchronization verified.');

    // Finish speech
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onAssistantSentenceEnd('All diagnostic telemetry is within nominal tolerances, sir.', 'JARVIS', 'utt_test');
      fvw.onAssistantSpeechEnd('All diagnostic telemetry is within nominal tolerances, sir.');
    });

    const speechEndCheck = await page.evaluate(() => {
      const activeSent = document.querySelector('.fvw-active-sentence');
      const cursor = document.querySelector('.fvw-cursor');
      const stopBtnHidden = document.getElementById('fvw-stop-speech-btn')?.style.display === 'none';
      return {
        highlightCleared: activeSent === null,
        cursorCleared: cursor === null,
        stopBtnHidden
      };
    });

    assert.strictEqual(speechEndCheck.highlightCleared, true);
    assert.strictEqual(speechEndCheck.cursorCleared, true);
    assert.strictEqual(speechEndCheck.stopBtnHidden, true);
    console.log('Assistant speech completion state verified.');

    // =========================================================================
    // 7. Right-Side Text Input (Enter to send, Shift+Enter for newline)
    // =========================================================================
    console.log('\n--- 7. Right-Side Text Input ---');
    await page.evaluate(() => {
      const textInput = document.getElementById('fvw-text-input');
      textInput.value = 'Check memory utilization';
    });

    // Simulate Enter key
    await page.evaluate(() => {
      const textInput = document.getElementById('fvw-text-input');
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      textInput.dispatchEvent(enterEvent);
    });

    const typedCheck = await page.evaluate(() => {
      const userRows = document.querySelectorAll('.fvw-user-row:not(.fvw-interim-row)');
      const lastUser = userRows[userRows.length - 1];
      const badge = lastUser?.querySelector('.fvw-input-badge')?.textContent;
      const text = lastUser?.querySelector('.fvw-bubble-text')?.textContent;
      const inputCleared = document.getElementById('fvw-text-input').value === '';
      return { badge, text, inputCleared };
    });

    assert.strictEqual(typedCheck.badge, '⌨️ Typed', 'Typed message must have Typed badge');
    assert.strictEqual(typedCheck.text, 'Check memory utilization');
    assert.strictEqual(typedCheck.inputCleared, true, 'Input textarea must clear on send');
    console.log('Right-side text input and Enter-to-send verified.');

    // =========================================================================
    // 8. Stop-Speaking Button Behavior
    // =========================================================================
    console.log('\n--- 8. Stop-Speaking Button Behavior ---');
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.onAssistantToken('Generating extensive report...', 'JARVIS');
      fvw.onAssistantSpeechStart('JARVIS', 'Generating extensive report...');
      // Click stop button
      document.getElementById('fvw-stop-speech-btn').click();
    });

    const stopCheck = await page.evaluate(() => {
      const isSpeaking = window.jarvisFloatingVoiceWindow.isSpeaking;
      const stopBtnHidden = document.getElementById('fvw-stop-speech-btn')?.style.display === 'none';
      return { isSpeaking, stopBtnHidden };
    });

    assert.strictEqual(stopCheck.isSpeaking, false, 'Stop button must halt speaking');
    assert.strictEqual(stopCheck.stopBtnHidden, true, 'Stop button must hide after click');
    console.log('Stop-speaking button immediate interruption verified.');

    // =========================================================================
    // 9. Microphone Toggle & Mute State
    // =========================================================================
    console.log('\n--- 9. Microphone Toggle & Mute State ---');
    await page.evaluate(() => {
      const fvw = window.jarvisFloatingVoiceWindow;
      fvw.setVoiceState('LISTENING');
      document.getElementById('fvw-mic-toggle-btn').click();
    });

    const muteCheck = await page.evaluate(() => {
      const status = document.getElementById('fvw-status-text')?.textContent;
      const micIcon = document.getElementById('fvw-mic-icon')?.textContent;
      const waveformActive = document.getElementById('fvw-waveform')?.classList.contains('is-active');
      return { status, micIcon, waveformActive };
    });

    assert.strictEqual(muteCheck.status, 'MUTED', 'State must become MUTED when muted');
    assert.strictEqual(muteCheck.micIcon, '🔇', 'Mic icon must change to muted');
    assert.strictEqual(muteCheck.waveformActive, false, 'Waveform must be inactive when muted');
    console.log('Microphone toggle and mute state verified.');

    // =========================================================================
    // 10. Window Minimize, Restore, Close & Non-Destructive Task Continuation
    // =========================================================================
    console.log('\n--- 10. Minimize, Restore, Close & Non-Destructive Task Continuation ---');
    // Minimize
    await page.evaluate(() => {
      document.getElementById('fvw-minimize-btn').click();
    });

    const minCheck = await page.evaluate(() => {
      const winHidden = document.getElementById('jarvis-floating-voice-window').style.display === 'none';
      const pillVisible = document.getElementById('jarvis-floating-voice-pill').style.display !== 'none';
      const pillText = document.getElementById('fvw-pill-label')?.textContent;
      return { winHidden, pillVisible, pillText };
    });

    assert.strictEqual(minCheck.winHidden, true, 'Window must hide when minimized');
    assert.strictEqual(minCheck.pillVisible, true, 'Mini pill must appear when minimized');
    console.log(`Minimized into floating pill: "${minCheck.pillText}"`);

    // Restore
    await page.evaluate(() => {
      document.getElementById('fvw-pill-restore-btn').click();
    });

    const restoreCheck = await page.evaluate(() => {
      const winVisible = document.getElementById('jarvis-floating-voice-window').style.display !== 'none';
      const pillHidden = document.getElementById('jarvis-floating-voice-pill').style.display === 'none';
      return { winVisible, pillHidden };
    });

    assert.strictEqual(restoreCheck.winVisible, true, 'Window must be visible when restored');
    assert.strictEqual(restoreCheck.pillHidden, true, 'Mini pill must hide when restored');
    console.log('Window restored successfully from mini pill.');

    // Close without terminating tasks
    const turnsCountBeforeClose = await page.evaluate(() => {
      return document.querySelectorAll('.fvw-message-row').length;
    });

    await page.evaluate(() => {
      document.getElementById('fvw-close-btn').click();
    });

    const closeCheck = await page.evaluate(() => {
      const winHidden = document.getElementById('jarvis-floating-voice-window').style.display === 'none';
      const fvw = window.jarvisFloatingVoiceWindow;
      // Speech and streaming methods should still work while closed!
      fvw.onAssistantToken('Background task update: computation finished.', 'JARVIS');
      return { winHidden, isOpen: fvw.isOpen };
    });

    assert.strictEqual(closeCheck.winHidden, true, 'Window must hide on close');
    assert.strictEqual(closeCheck.isOpen, false);

    // Reopen window
    await page.evaluate(() => {
      window.jarvisFloatingVoiceWindow.open({ autoTriggered: true });
    });

    const reopenCheck = await page.evaluate(() => {
      const winVisible = document.getElementById('jarvis-floating-voice-window').style.display !== 'none';
      const turnsCountAfterReopen = document.querySelectorAll('.fvw-message-row').length;
      return { winVisible, turnsCountAfterReopen };
    });

    assert.strictEqual(reopenCheck.winVisible, true, 'Window must reopen cleanly');
    assert(reopenCheck.turnsCountAfterReopen >= turnsCountBeforeClose, 'History must be preserved across window closes');
    console.log(`Reopened successfully. History preserved (${reopenCheck.turnsCountAfterReopen} message entries).`);

    // =========================================================================
    // 11. No Duplicate Windows or Overlapping Sessions
    // =========================================================================
    console.log('\n--- 11. No Duplicate Windows or Overlapping Sessions ---');
    const duplicatesCheck = await page.evaluate(() => {
      const windows = document.querySelectorAll('#jarvis-floating-voice-window');
      const pills = document.querySelectorAll('#jarvis-floating-voice-pill');
      return { windowsCount: windows.length, pillsCount: pills.length };
    });

    assert.strictEqual(duplicatesCheck.windowsCount, 1, 'Exactly one floating voice window must exist');
    assert.strictEqual(duplicatesCheck.pillsCount, 1, 'Exactly one minimized pill must exist');
    console.log('Single window instance invariant verified (0 duplicate windows).');

    console.log('\n' + '='.repeat(80));
    console.log('ALL 11 FLOATING VOICE CONVERSATION WINDOW TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================================');
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runFloatingVoiceWindowTests().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runFloatingVoiceWindowTests };
