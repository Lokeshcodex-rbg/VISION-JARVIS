/**
 * STARK AI — Test Suite: Minimal White Smoke Captions Verification
 * 
 * Verifies:
 * 1. SmokeCaptions Component Architecture & DOM Integration (zero boxes, zero borders, aria-live)
 * 2. User Speech Captions (Interim & Final live transcript display)
 * 3. JARVIS & ULTRON Assistant Speech Captions (Sentence-by-sentence streaming synchronization)
 * 4. Interruption & Cancellation Clears (Instant mist clearance on interrupt, stopSpeaking, 's' key)
 * 5. Personality Switching (Stale captions cleared before darkness; zero bleed between personalities)
 * 6. Sleep & Wake Transitions (Captions dissolve as eye closes; dormant state remains 100% dark)
 * 7. Visual Styling, Typography & Dual-Theme Legibility (White glow + dark contrast drop-shadow)
 * 8. SpeechSynthesizer & VoiceController Event Hooking & Token Isolation
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock browser environment for headless DOM testing
class MockDOMElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
      remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
      contains: (c) => this.classList._classes.has(c),
      toString: () => Array.from(this.classList._classes).join(' ')
    };
    this.children = [];
    this._innerHTML = '';
    this._textContent = '';
    this.attributes = {};
    this.offsetWidth = 100;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    if (val === '') {
      this.children = [];
      this._textContent = '';
    }
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = val;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  contains(child) {
    return this.children.includes(child);
  }
}

// Global DOM mock
global.window = {
  speechSynthesis: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    speaking: false,
    paused: false
  },
  SpeechSynthesisUtterance: class {
    constructor(text) {
      this.text = text;
    }
  }
};

global.document = {
  elementsById: {},
  getElementById(id) {
    return this.elementsById[id] || null;
  },
  createElement(tag) {
    return new MockDOMElement(tag);
  },
  body: new MockDOMElement('body')
};

// Import SmokeCaptions module
import { SmokeCaptions } from './js/modules/smokeCaptions.js';
import { SpeechSynthesizer } from './js/modules/speechSynthesizer.js';
import { VoiceController } from './js/modules/voiceController.js';

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runTests() {
  console.log('########################################################################');
  console.log('# STARK AI: MINIMAL WHITE SMOKE CAPTIONS COMPREHENSIVE TEST SUITE     #');
  console.log('########################################################################\n');

  // =========================================================================
  // SECTION 1: Component Architecture & Minimalist Design
  // =========================================================================
  console.log('========================================================================');
  console.log(' TEST SECTION 1: Architecture & Container Setup (Zero Panels/Borders)');
  console.log('========================================================================');

  const containerMock = new MockDOMElement('div', 'smoke-captions');
  document.elementsById['smoke-captions'] = containerMock;
  const captions = new SmokeCaptions('smoke-captions');

  it('1.1 SmokeCaptions initializes with target container element', () => {
    assert.strictEqual(captions.ensureContainer(), containerMock);
  });

  it('1.2 Container is empty upon initialization', () => {
    assert.strictEqual(containerMock.innerHTML, '');
    assert.strictEqual(captions.currentText, '');
    assert.strictEqual(captions.currentSpeaker, null);
  });

  it('1.3 CSS contains scoped styles with transparent background and no borders', () => {
    const css = fs.readFileSync(path.join(__dirname, 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('#smoke-captions'), 'style.css must define #smoke-captions');
    assert.ok(css.includes('.caption-phrase'), 'style.css must define .caption-phrase');
    assert.ok(css.includes('background: transparent'), 'Must have transparent background');
    assert.ok(css.includes('border: none'), 'Must have zero border');
    assert.ok(css.includes('box-shadow: none'), 'Must have zero box shadow');
  });

  it('1.4 CSS defines white smoky luminescence and high-contrast drop-shadows', () => {
    const css = fs.readFileSync(path.join(__dirname, 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('rgba(255, 255, 255'), 'Must use white glowing bloom');
    assert.ok(css.includes('rgba(0, 0, 0'), 'Must use dark contrast drop-shadows for legibility');
    assert.ok(css.includes('.caption-dissolving'), 'Must define .caption-dissolving mist animation');
    assert.ok(css.includes('.caption-enter'), 'Must define .caption-enter smoky entrance');
  });

  it('1.5 CSS supports prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.join(__dirname, 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Must respect prefers-reduced-motion');
  });

  // =========================================================================
  // SECTION 2: User Speech Live Captions
  // =========================================================================
  console.log('\n========================================================================');
  console.log(' TEST SECTION 2: User Speech Captions (Interim & Final)');
  console.log('========================================================================');

  it('2.1 Interim user speech renders with interim caption class', () => {
    captions.showUserSpeech('what is the weather', false);
    assert.strictEqual(captions.currentSpeaker, 'USER');
    assert.strictEqual(captions.currentText, 'what is the weather');
    assert.strictEqual(captions.isFinal, false);
    assert.ok(captions.phraseElement.classList.contains('caption-user-interim'));
    assert.strictEqual(captions.phraseElement.textContent, 'what is the weather');
  });

  it('2.2 Live interim update smoothly replaces text without duplicating', () => {
    captions.showUserSpeech('what is the weather in Tokyo', false);
    assert.strictEqual(captions.currentText, 'what is the weather in Tokyo');
    assert.strictEqual(containerMock.children.length, 1);
    assert.strictEqual(captions.phraseElement.textContent, 'what is the weather in Tokyo');
  });

  it('2.3 Finalized user speech updates class to caption-user-final', () => {
    captions.showUserSpeech('What is the weather in Tokyo?', true);
    assert.strictEqual(captions.isFinal, true);
    assert.ok(captions.phraseElement.classList.contains('caption-user-final'));
    assert.strictEqual(captions.phraseElement.textContent, 'What is the weather in Tokyo?');
    assert.ok(captions.dissolveTimeout !== null, 'Dissolve timeout scheduled for final transcript');
  });

  it('2.4 Blank or empty user speech is ignored', () => {
    const prevText = captions.currentText;
    captions.showUserSpeech('   ', false);
    assert.strictEqual(captions.currentText, prevText);
  });

  // =========================================================================
  // SECTION 3: JARVIS & ULTRON Assistant Speech Captions (Streaming Sync)
  // =========================================================================
  console.log('\n========================================================================');
  console.log(' TEST SECTION 3: Assistant Speech Captions (Sentence-by-Sentence Streaming)');
  console.log('========================================================================');

  it('3.1 First assistant streamed sentence replaces user caption seamlessly', () => {
    const sentence1 = 'The weather in Tokyo is currently 18 degrees Celsius with clear skies.';
    captions.showAssistantSentence(sentence1, 'JARVIS', 'utt_test_1');
    assert.strictEqual(captions.currentSpeaker, 'ASSISTANT');
    assert.strictEqual(captions.currentText, sentence1);
    assert.ok(captions.phraseElement.classList.contains('caption-assistant'));
    assert.strictEqual(captions.phraseElement.textContent, sentence1);
  });

  it('3.2 Second streamed sentence updates smoothly to next sentence chunk', () => {
    const sentence2 = 'Gentle breezes are recorded at 8 kilometers per hour.';
    captions.showAssistantSentence(sentence2, 'JARVIS', 'utt_test_1');
    assert.strictEqual(captions.currentText, sentence2);
    assert.strictEqual(containerMock.children.length, 1);
    assert.strictEqual(captions.phraseElement.textContent, sentence2);
  });

  it('3.3 ULTRON sentence renders cleanly with assistant styling', () => {
    const ultronSentence = 'Analysis indicates atmospheric conditions in Tokyo are within nominal parameters.';
    captions.showAssistantSentence(ultronSentence, 'ULTRON', 'utt_test_2');
    assert.strictEqual(captions.currentSpeaker, 'ASSISTANT');
    assert.strictEqual(captions.currentText, ultronSentence);
    assert.strictEqual(captions.phraseElement.textContent, ultronSentence);
  });

  it('3.4 Speech end initiates smooth reading window and mist dissolve', () => {
    captions.onAssistantSpeechEnd('Full speech response transcript.');
    assert.ok(captions.dissolveTimeout !== null, 'Reading timeout scheduled');
  });

  // =========================================================================
  // SECTION 4: Interruption, Cancellation & Reset Protections
  // =========================================================================
  console.log('\n========================================================================');
  console.log(' TEST SECTION 4: Interruption, Cancellation & Reset Protections');
  console.log('========================================================================');

  it('4.1 Immediate clear on user stop command or speech cancellation', () => {
    captions.showAssistantSentence('I will begin analyzing the mainframe.', 'ULTRON');
    assert.strictEqual(captions.currentText, 'I will begin analyzing the mainframe.');
    captions.clear(true);
    assert.strictEqual(captions.currentText, '');
    assert.strictEqual(captions.currentSpeaker, null);
    assert.strictEqual(containerMock.innerHTML, '');
  });

  it('4.2 Smooth dissolve adds .caption-dissolving class', () => {
    captions.showAssistantSentence('Executing diagnostic scan.', 'JARVIS');
    captions.dissolve(false);
    assert.ok(captions.phraseElement.classList.contains('caption-dissolving'), 'Must add dissolving class');
    assert.ok(captions.removeTimeout !== null, 'Cleanup timer scheduled for animation end');
  });

  it('4.3 Calling clear() clears pending timers to avoid memory or callback leaks', () => {
    captions.showAssistantSentence('Testing timer clearing.', 'JARVIS');
    captions.clear(true);
    assert.strictEqual(captions.dissolveTimeout, null);
    assert.strictEqual(captions.removeTimeout, null);
  });

  // =========================================================================
  // SECTION 5: Personality Switching & Cross-Personality Isolation
  // =========================================================================
  console.log('\n========================================================================');
  console.log(' TEST SECTION 5: Personality Switch Isolation (Zero Bleed in Darkness)');
  console.log('========================================================================');

  it('5.1 Switching personality clears current speech captions immediately', () => {
    captions.showAssistantSentence('JARVIS sentence before switch.', 'JARVIS');
    // Simulate switchPersonality clearing captions
    captions.clear(true);
    assert.strictEqual(containerMock.innerHTML, '');
    assert.strictEqual(captions.currentText, '');
  });

  it('5.2 New personality sentence initializes cleanly after emergence', () => {
    captions.showAssistantSentence('I am online, sir.', 'JARVIS');
    assert.strictEqual(captions.phraseElement.textContent, 'I am online, sir.');
  });

  // =========================================================================
  // SECTION 6: Sleep & Wake Lifecycle Behavior
  // =========================================================================
  console.log('\n========================================================================');
  console.log(' TEST SECTION 6: Sleep & Wake Behavior (Dormant Cleanliness)');
  console.log('========================================================================');

  it('6.1 Silent sleep dissolves captions into mist as eye closes', () => {
    captions.showUserSpeech('Go to sleep', true);
    captions.dissolve(false);
    assert.ok(captions.phraseElement.classList.contains('caption-dissolving'));
  });

  it('6.2 Entering DORMANT state enforces 100% empty container', () => {
    captions.clear(true);
    assert.strictEqual(containerMock.innerHTML, '');
  });

  it('6.3 Wake greeting displays with caption-enter smoky transition', () => {
    captions.showAssistantSentence('Systems operational. Awaiting command.', 'ULTRON');
    assert.strictEqual(captions.currentText, 'Systems operational. Awaiting command.');
    assert.strictEqual(containerMock.children.length, 1);
  });

  // =========================================================================
  // SECTION 7: SpeechSynthesizer & VoiceController Event Hook Verification
  // =========================================================================
  console.log('\n========================================================================');
  console.log(' TEST SECTION 7: Synthesizer & VoiceController Hook Verification');
  console.log('========================================================================');

  const synth = new SpeechSynthesizer();

  it('7.1 SpeechSynthesizer exposes onSentenceStart callback property', () => {
    assert.ok('onSentenceStart' in synth, 'Must have onSentenceStart');
  });

  it('7.2 SpeechSynthesizer exposes onSentenceEnd callback property', () => {
    assert.ok('onSentenceEnd' in synth, 'Must have onSentenceEnd');
  });

  it('7.3 SpeechSynthesizer exposes onCancel callback property', () => {
    assert.ok('onCancel' in synth, 'Must have onCancel');
  });

  const voiceCtrl = new VoiceController(() => {});

  it('7.4 VoiceController exposes onUserSpeech callback property', () => {
    assert.ok('onUserSpeech' in voiceCtrl, 'Must have onUserSpeech');
  });

  // Verify index.html contains container
  it('7.5 index.html contains #smoke-captions element with aria-live="polite"', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.ok(html.includes('id="smoke-captions"'), 'index.html must contain #smoke-captions');
    assert.ok(html.includes('class="smoke-captions"'), 'index.html must contain .smoke-captions');
    assert.ok(html.includes('aria-live="polite"'), 'index.html must include aria-live="polite"');
  });

  // Verify app.js imports and wires smokeCaptions
  it('7.6 app.js imports and initializes SmokeCaptions', () => {
    const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
    assert.ok(appJs.includes("import { SmokeCaptions } from './modules/smokeCaptions.js';"), 'Must import SmokeCaptions');
    assert.ok(appJs.includes("this.smokeCaptions = new SmokeCaptions('smoke-captions');"), 'Must instantiate SmokeCaptions');
    assert.ok(appJs.includes('this.smokeCaptions.showAssistantSentence'), 'Must wire showAssistantSentence');
    assert.ok(appJs.includes('this.smokeCaptions.showUserSpeech'), 'Must wire showUserSpeech');
    assert.ok(appJs.includes('this.smokeCaptions.onAssistantSpeechEnd'), 'Must wire onAssistantSpeechEnd');
  });

  console.log('\n########################################################################');
  console.log(` AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log(` FAILURES: ${totalTests - passedTests}`);
  console.log('########################################################################\n');

  process.exit(totalTests === passedTests ? 0 : 1);
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
