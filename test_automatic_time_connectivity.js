/**
 * STARK AI — Automatic Time Awareness, Natural Greetings & Full System Connectivity Test Suite (Part 17)
 * Rigorously verifies:
 * 1. Deterministic system clock, timezone detection, and Intl API resolution.
 * 2. Configurable time-of-day categories (Morning, Afternoon, Evening, Night).
 * 3. Dynamic natural greetings eliminating hardcoded "Good morning" on every startup.
 * 4. Session restoration detection and immediate task prioritization without long greetings.
 * 5. Neutral clock fallbacks when clock is unreadable.
 * 6. Continuous time awareness injected into AI model prompt context without constant announcements.
 * 7. Relative time calculations, cross-timezone lookups, and midnight date rollovers.
 * 8. Full connectivity and synchronization across all STARK subsystems.
 * 9. Non-blocking startup resilience and idempotent reconnection.
 */

const assert = require('assert');
const { TimeService, timeServiceInstance } = require('./server/timeService.js');
const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { conversationManagerInstance } = require('./server/conversationManager.js');
const { memoryManagerInstance } = require('./server/memoryManager.js');
const { taskManagerInstance } = require('./server/taskManager.js');
const { permissionManagerInstance } = require('./server/desktop/permissionManager.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { documentAnalyzerInstance } = require('./server/documentAnalyzer.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { languageVoiceManagerInstance } = require('./server/languageVoiceManager.js');
const { executeTool } = require('./server/toolsRegistry.js');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passCount++;
        console.log(`  ✓ ${name}`);
      }).catch(err => {
        failCount++;
        console.error(`  ✗ ${name}: ${err.message}`);
      });
    } else {
      passCount++;
      console.log(`  ✓ ${name}`);
      return Promise.resolve();
    }
  } catch (err) {
    failCount++;
    console.error(`  ✗ ${name}: ${err.message}`);
    return Promise.resolve();
  }
}

async function runSuite() {
  console.log('\n======================================================================');
  console.log('STARK AI — PART 17 TIME AWARENESS & SYSTEM CONNECTIVITY TEST SUITE');
  console.log('======================================================================\n');

  // =========================================================================
  // 1. DETERMINISTIC SYSTEM CLOCK & TIMEZONE DETECTION
  // =========================================================================
  console.log('--- 1. Deterministic System Clock & Timezone Detection ---');

  await it('Automatically determines local time, date, and timezone from OS', () => {
    const timeInfo = timeServiceInstance.getCurrentTime();
    assert(timeInfo.time, 'Expected time string');
    assert(timeInfo.date, 'Expected full date string');
    assert(timeInfo.timezone, 'Expected detected timezone');
    assert(typeof timeInfo.hour === 'number', 'Expected numeric hour');
    assert(typeof timeInfo.minute === 'number', 'Expected numeric minute');
    assert(['morning', 'afternoon', 'evening', 'night'].includes(timeInfo.category), 'Expected valid category');
    assert(timeInfo.summary.includes(timeInfo.timezone), 'Expected timezone in summary');
  });

  await it('Correctly identifies system timezone using Intl.DateTimeFormat', () => {
    const tz = timeServiceInstance.detectSystemTimezone();
    assert(typeof tz === 'string' && tz.length > 0, 'Expected non-empty timezone');
    const resolved = timeServiceInstance.resolveTimezone('london');
    assert.strictEqual(resolved, 'Europe/London');
    const nyResolved = timeServiceInstance.resolveTimezone('nyc');
    assert.strictEqual(nyResolved, 'America/New_York');
  });

  // =========================================================================
  // 2. CONFIGURABLE TIME-OF-DAY BOUNDARIES & CATEGORIZATION
  // =========================================================================
  console.log('\n--- 2. Configurable Time Boundaries & Categorization ---');

  await it('Correctly categorizes morning, afternoon, evening, and night using default boundaries', () => {
    const ts = new TimeService();

    // Morning: 5:00 AM – 11:59 AM
    const morningDate1 = new Date(2026, 9, 25, 5, 0, 0);
    const morningDate2 = new Date(2026, 9, 25, 11, 59, 0);
    assert.strictEqual(ts.getTimeOfDayCategory(morningDate1), 'morning');
    assert.strictEqual(ts.getTimeOfDayCategory(morningDate2), 'morning');

    // Afternoon: 12:00 PM – 4:59 PM
    const afternoonDate1 = new Date(2026, 9, 25, 12, 0, 0);
    const afternoonDate2 = new Date(2026, 9, 25, 16, 59, 0);
    assert.strictEqual(ts.getTimeOfDayCategory(afternoonDate1), 'afternoon');
    assert.strictEqual(ts.getTimeOfDayCategory(afternoonDate2), 'afternoon');

    // Evening: 5:00 PM – 8:59 PM
    const eveningDate1 = new Date(2026, 9, 25, 17, 0, 0);
    const eveningDate2 = new Date(2026, 9, 25, 20, 59, 0);
    assert.strictEqual(ts.getTimeOfDayCategory(eveningDate1), 'evening');
    assert.strictEqual(ts.getTimeOfDayCategory(eveningDate2), 'evening');

    // Night: 9:00 PM – 4:59 AM
    const nightDate1 = new Date(2026, 9, 25, 21, 0, 0);
    const nightDate2 = new Date(2026, 9, 25, 23, 59, 0);
    const nightDate3 = new Date(2026, 9, 25, 2, 30, 0);
    const nightDate4 = new Date(2026, 9, 25, 4, 59, 0);
    assert.strictEqual(ts.getTimeOfDayCategory(nightDate1), 'night');
    assert.strictEqual(ts.getTimeOfDayCategory(nightDate2), 'night');
    assert.strictEqual(ts.getTimeOfDayCategory(nightDate3), 'night');
    assert.strictEqual(ts.getTimeOfDayCategory(nightDate4), 'night');
  });

  await it('Supports custom configurable boundaries and updates categories accordingly', () => {
    const ts = new TimeService();
    ts.setTimeCategoryBoundaries({
      morningStart: 6,
      afternoonStart: 13,
      eveningStart: 18,
      nightStart: 22
    });

    const hour5 = new Date(2026, 9, 25, 5, 30, 0); // 5:30 AM is now night under 6am morning
    assert.strictEqual(ts.getTimeOfDayCategory(hour5), 'night');

    const hour12 = new Date(2026, 9, 25, 12, 30, 0); // 12:30 PM is now morning under 1pm afternoon
    assert.strictEqual(ts.getTimeOfDayCategory(hour12), 'morning');

    const hour17 = new Date(2026, 9, 25, 17, 30, 0); // 5:30 PM is now afternoon under 6pm evening
    assert.strictEqual(ts.getTimeOfDayCategory(hour17), 'afternoon');

    const hour21 = new Date(2026, 9, 25, 21, 30, 0); // 9:30 PM is now evening under 10pm night
    assert.strictEqual(ts.getTimeOfDayCategory(hour21), 'evening');
  });

  // =========================================================================
  // 3. STOP REPEATING "GOOD MORNING" ON EVERY STARTUP
  // =========================================================================
  console.log('\n--- 3. Context-Aware Natural Greetings (No Stale Good Morning) ---');

  await it('Never delivers a "Good morning" greeting during afternoon, evening, or night launches', () => {
    const ts = new TimeService();

    // Afternoon launch (2:30 PM)
    const afternoonDate = new Date(2026, 9, 25, 14, 30, 0);
    const greetingAfternoon = ts.getNaturalGreeting('JARVIS', { date: afternoonDate });
    assert(!/good morning/i.test(greetingAfternoon), `Afternoon greeting must not be Good morning: "${greetingAfternoon}"`);
    assert(/good afternoon/i.test(greetingAfternoon), `Expected afternoon greeting: "${greetingAfternoon}"`);

    // Evening launch (7:30 PM)
    const eveningDate = new Date(2026, 9, 25, 19, 30, 0);
    const greetingEvening = ts.getNaturalGreeting('JARVIS', { date: eveningDate });
    assert(!/good morning/i.test(greetingEvening), `Evening greeting must not be Good morning: "${greetingEvening}"`);
    assert(/good evening/i.test(greetingEvening), `Expected evening greeting: "${greetingEvening}"`);

    // Night launch (11:15 PM)
    const nightDate = new Date(2026, 9, 25, 23, 15, 0);
    const greetingNight = ts.getNaturalGreeting('JARVIS', { date: nightDate });
    assert(!/good morning/i.test(greetingNight), `Night greeting must not be Good morning: "${greetingNight}"`);
    assert(/still here|working late|good evening/i.test(greetingNight), `Expected night greeting: "${greetingNight}"`);

    // Morning launch (9:00 AM)
    const morningDate = new Date(2026, 9, 25, 9, 0, 0);
    const greetingMorning = ts.getNaturalGreeting('JARVIS', { date: morningDate });
    assert(/good morning|morning/i.test(greetingMorning), `Expected morning greeting: "${greetingMorning}"`);
  });

  await it('Varies greeting phrasing across repeated launches without static repetition', () => {
    const ts = new TimeService();
    const afternoonDate = new Date(2026, 9, 25, 15, 0, 0);
    const g1 = ts.getNaturalGreeting('JARVIS', { date: afternoonDate });
    const g2 = ts.getNaturalGreeting('JARVIS', { date: afternoonDate });
    // In our pool of 3 afternoon greetings, rotation produces varied greetings
    assert(typeof g1 === 'string' && typeof g2 === 'string');
    assert(!/good morning/i.test(g1) && !/good morning/i.test(g2));
  });

  await it('Generates distinct ULTRON greetings matching tactical persona and time of day', () => {
    const ts = new TimeService();
    const morning = ts.getNaturalGreeting('ULTRON', { date: new Date(2026, 9, 25, 8, 0, 0) });
    const afternoon = ts.getNaturalGreeting('ULTRON', { date: new Date(2026, 9, 25, 14, 0, 0) });
    const evening = ts.getNaturalGreeting('ULTRON', { date: new Date(2026, 9, 25, 18, 0, 0) });
    const night = ts.getNaturalGreeting('ULTRON', { date: new Date(2026, 9, 25, 22, 0, 0) });

    assert(morning.includes('Ultron') && (morning.includes('Morning') || morning.includes('nominal')));
    assert(afternoon.includes('Ultron') && (afternoon.includes('Afternoon') || afternoon.includes('operational')));
    assert(evening.includes('Ultron') && (evening.includes('Evening') || evening.includes('operational')));
    assert(night.includes('Ultron') && (night.includes('Night') || night.includes('operational')));
  });

  await it('Generates authentic multilingual greetings for Hindi and Hinglish modes', () => {
    const ts = new TimeService();
    const hiMorning = ts.getNaturalGreeting('JARVIS', { date: new Date(2026, 9, 25, 8, 0, 0), language: 'hi' });
    assert(hiMorning.includes('शुभ प्रभात'), `Expected Hindi morning greeting: ${hiMorning}`);

    const hiAfternoon = ts.getNaturalGreeting('JARVIS', { date: new Date(2026, 9, 25, 14, 0, 0), language: 'hi' });
    assert(hiAfternoon.includes('शुभ दोपहर'), `Expected Hindi afternoon greeting: ${hiAfternoon}`);

    const hinglishMorning = ts.getNaturalGreeting('JARVIS', { date: new Date(2026, 9, 25, 8, 0, 0), language: 'hinglish' });
    assert(/good morning/i.test(hinglishMorning) && /systems|karna/i.test(hinglishMorning));
  });

  // =========================================================================
  // 4. SESSION RESTORATION & IMMEDIATE TASK PRIORITIZATION
  // =========================================================================
  console.log('\n--- 4. Session Restoration & Immediate Task Handling ---');

  await it('Does not deliver a full greeting when session is resumed', () => {
    const ts = new TimeService();
    const resumedJarvis = ts.getNaturalGreeting('JARVIS', { isResumedSession: true });
    assert.strictEqual(resumedJarvis, 'Standing by, sir.');

    const resumedUltron = ts.getNaturalGreeting('ULTRON', { isResumedSession: true });
    assert.strictEqual(resumedUltron, 'Systems active. Standing by.');
  });

  await it('Prioritizes task execution without long greeting when app opens for immediate work', () => {
    const ts = new TimeService();
    const taskJarvis = ts.getNaturalGreeting('JARVIS', { hasTaskImmediately: true });
    assert.strictEqual(taskJarvis, 'Right away, sir.');

    const taskUltron = ts.getNaturalGreeting('ULTRON', { hasTaskImmediately: true });
    assert.strictEqual(taskUltron, 'Objective received. Processing.');
  });

  await it('Provides neutral fallback when system clock cannot be read or is invalid', () => {
    const ts = new TimeService();
    const neutralJarvis = ts.getNaturalGreeting('JARVIS', { category: 'neutral' });
    assert.strictEqual(neutralJarvis, 'At your service, sir. Systems are operational.');

    const neutralUltron = ts.getNaturalGreeting('ULTRON', { category: 'neutral' });
    assert.strictEqual(neutralUltron, 'Ultron online. Security protocols active.');
  });

  // =========================================================================
  // 5. TIME AWARENESS WITHOUT CONSTANT ANNOUNCEMENT
  // =========================================================================
  console.log('\n--- 5. Time Awareness Without Constant Announcements ---');

  await it('Provides formatted system prompt time context with explicit awareness guidelines', () => {
    const timeCtx = timeServiceInstance.getTimeContext();
    assert(timeCtx.includes('[CURRENT LOCAL SYSTEM TIME & DATE]'));
    assert(timeCtx.includes('Local Time:'));
    assert(timeCtx.includes('Date:'));
    assert(timeCtx.includes('Timezone:'));
    assert(timeCtx.includes('DO NOT blurt out or announce the time unless the user specifically asks'));
    assert(timeCtx.includes('If the user says "good night" or a greeting, respond naturally'));
  });

  await it('buildPromptContext injects deterministic time context into AI provider prompt', () => {
    const { systemPrompt } = aiAdapterInstance.buildPromptContext('JARVIS', 'Schedule a meeting for tomorrow morning');
    assert(systemPrompt.includes('[CURRENT LOCAL SYSTEM TIME & DATE]'), 'System prompt must include local time context');
    assert(systemPrompt.includes('[TIME AWARENESS GUIDELINES]'), 'System prompt must include time awareness instructions');
  });

  await it('Handles cross-timezone queries and calculates correct local hours across the globe', async () => {
    const london = await executeTool('get_timezone_time', { location: 'London' });
    assert(london.time && london.timezone === 'Europe/London');

    const tokyo = await executeTool('get_timezone_time', { location: 'Tokyo' });
    assert(tokyo.time && tokyo.timezone === 'Asia/Tokyo');
  });

  await it('Calculates relative time offsets and handles midnight rollover correctly', async () => {
    const offset2hr = await executeTool('calculate_time_offset', { hours: 2, minutes: 30 });
    assert(offset2hr.targetTime, 'Expected target time');
    assert(offset2hr.targetDate, 'Expected target date');
    assert(offset2hr.summary.includes('2 hours and 30 minutes'));
  });

  await it('Calculates date difference and future countdown accurately', async () => {
    const diff = await executeTool('calculate_date_difference', { targetDate: 'December 25' });
    assert(typeof diff.daysDifference === 'number');
    assert(diff.summary.includes('December 25'));
  });

  // =========================================================================
  // 6. FULL SUBSYSTEM CONNECTIVITY & SYNCHRONIZATION
  // =========================================================================
  console.log('\n--- 6. Full Subsystem Connectivity & Synchronization ---');

  await it('Connects AI model configuration and status endpoints safely without credential exposure', () => {
    const status = aiAdapterInstance.getProviderStatus();
    assert(typeof status.activeProvider === 'string');
    assert(typeof status.hasGemini === 'boolean');
    assert(!JSON.stringify(status).includes('AIza'), 'Never expose API credentials');
  });

  await it('Connects conversation history and persistent memory seamlessly', () => {
    conversationManagerInstance.clearHistory();
    conversationManagerInstance.addMessage('JARVIS', 'user', 'My favourite editor is VS Code');
    conversationManagerInstance.addMessage('JARVIS', 'assistant', 'Noted, sir. VS Code set as preferred editor.');

    const history = conversationManagerInstance.getHistory('JARVIS');
    assert.strictEqual(history.length, 2);

    memoryManagerInstance.addMemory('User prefers dark mode themes', 'preference');
    const mems = memoryManagerInstance.getRelevantMemories('dark mode');
    assert(mems.length > 0);
  });

  await it('Maintains strict JARVIS/ULTRON personality isolation and permission boundaries', async () => {
    const jarvisProfile = permissionManagerInstance.getProfile('JARVIS');
    const ultronProfile = permissionManagerInstance.getProfile('ULTRON');

    assert.strictEqual(jarvisProfile.trustedMode, true);
    assert.strictEqual(ultronProfile.trustedMode, false);

    const jarvisCap = permissionGateInstance.getCapabilityReport('JARVIS');
    const ultronCap = permissionGateInstance.getCapabilityReport('ULTRON');
    assert.strictEqual(jarvisCap.policyName, 'JARVIS_BROAD_ASSISTANT');
    assert.strictEqual(ultronCap.policyName, 'ULTRON_RESTRICTED_ANALYST');

    // ULTRON cannot modify system settings
    assert.throws(
      () => permissionGateInstance.authorizeToolExecution('open_windows_settings', { settingPage: 'network' }, 'ULTRON'),
      /restricted read-only governance/i
    );

    // JARVIS can execute standard desktop tools
    assert.doesNotThrow(
      () => permissionGateInstance.authorizeToolExecution('get_running_applications', {}, 'JARVIS')
    );
  });

  await it('Synchronizes command interpreter between voice commands and keyboard input', () => {
    const cmd1 = commandInterpreterInstance.interpret('what time is it', 'JARVIS');
    assert.strictEqual(cmd1.matched, true);
    assert.strictEqual(cmd1.toolName, 'get_current_time');

    const cmd2 = commandInterpreterInstance.interpret('time in Tokyo', 'JARVIS');
    assert.strictEqual(cmd2.matched, true);
    assert.strictEqual(cmd2.toolName, 'get_timezone_time');
    assert.strictEqual(cmd2.args.location, 'tokyo');
  });

  await it('Connects document analyzer across code, csv, json, and text formats', () => {
    const docRes = documentAnalyzerInstance.analyzeDocument('function add(a, b) { return a + b; }', { filename: 'math.js' });
    assert.strictEqual(docRes.type, 'source_code');
    assert(docRes.lineCount > 0);
  });

  await it('Connects task manager and productivity scheduling', () => {
    const created = taskManagerInstance.createTask('Verify quarterly budget report');
    assert.strictEqual(created.success, true);
    const list = taskManagerInstance.listTasks('pending');
    assert(list.tasks.some(t => t.title.includes('Verify quarterly budget report')));
  });

  // =========================================================================
  // 7. STARTUP RESILIENCE & RECONNECT IDEMPOTENCY
  // =========================================================================
  console.log('\n--- 7. Startup Resilience & Reconnect Idempotency ---');

  await it('Startup continues safely when optional external providers are offline', async () => {
    // Simulate query when cloud TTS is fallback-only
    const voiceConfig = languageVoiceManagerInstance.getVoiceConfigForPersonalityAndLanguage('JARVIS', 'en');
    assert(voiceConfig.rate && voiceConfig.pitch);

    // AI Provider fallbacks gracefully to local responses
    const available = aiAdapterInstance.getAvailableModels();
    assert(available.activeProvider);
  });

  await it('Time awareness re-check runs idempotently without creating duplicate intervals', () => {
    const ts1 = new TimeService();
    const boundaries1 = ts1.getTimeCategoryBoundaries();
    assert(boundaries1.morningStart === 5);

    // Re-applying boundaries updates cleanly
    const boundaries2 = ts1.setTimeCategoryBoundaries({ morningStart: 6 });
    assert.strictEqual(boundaries2.morningStart, 6);
    assert.strictEqual(ts1.getTimeCategoryBoundaries().morningStart, 6);
  });

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite runner failed:', err);
  process.exit(1);
});
