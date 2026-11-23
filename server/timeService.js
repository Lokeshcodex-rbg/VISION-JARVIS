/**
 * VISION AI — Deterministic High-Precision Time, Date & Timezone Engine
 * Reads system hardware clock and local timezone.
 * Features:
 * 1. Automatic local time, date, and timezone detection using OS and Intl APIs.
 * 2. Configurable time-of-day categories (Morning, Afternoon, Evening, Night).
 * 3. Natural context-aware greeting generator (eliminates hardcoded "Good morning").
 * 4. Relative time offsets, cross-timezone conversions, and countdown calculations.
 * 5. Neutral fallbacks when clock data is unreadable or uncertain.
 */

const TIMEZONE_MAP = {
  // United Kingdom
  'london': 'Europe/London',
  'uk': 'Europe/London',
  'britain': 'Europe/London',
  'england': 'Europe/London',
  'gmt': 'Europe/London',
  'utc': 'UTC',

  // United States & Canada
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'washington': 'America/New_York',
  'boston': 'America/New_York',
  'miami': 'America/New_York',
  'atlanta': 'America/New_York',
  'est': 'America/New_York',
  'edt': 'America/New_York',
  'chicago': 'America/Chicago',
  'cst': 'America/Chicago',
  'cdt': 'America/Chicago',
  'dallas': 'America/Chicago',
  'houston': 'America/Chicago',
  'denver': 'America/Denver',
  'mst': 'America/Denver',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles',
  'california': 'America/Los_Angeles',
  'pst': 'America/Los_Angeles',
  'pdt': 'America/Los_Angeles',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',

  // India
  'india': 'Asia/Kolkata',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'new delhi': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata',
  'bengaluru': 'Asia/Kolkata',
  'kolkata': 'Asia/Kolkata',
  'chennai': 'Asia/Kolkata',
  'hyderabad': 'Asia/Kolkata',
  'ist': 'Asia/Kolkata',

  // Asia / Pacific
  'tokyo': 'Asia/Tokyo',
  'japan': 'Asia/Tokyo',
  'singapore': 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  'dubai': 'Asia/Dubai',
  'uae': 'Asia/Dubai',
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Sydney',
  'brisbane': 'Australia/Brisbane',
  'auckland': 'Pacific/Auckland',
  'new zealand': 'Pacific/Auckland',

  // Europe
  'paris': 'Europe/Paris',
  'france': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'germany': 'Europe/Berlin',
  'amsterdam': 'Europe/Amsterdam',
  'rome': 'Europe/Rome',
  'madrid': 'Europe/Madrid',
  'zurich': 'Europe/Zurich',
  'moscow': 'Europe/Moscow',
  'cet': 'Europe/Paris',
  'cest': 'Europe/Paris'
};

const DEFAULT_BOUNDARIES = {
  morningStart: 5,   // 5:00 AM – 11:59 AM
  afternoonStart: 12, // 12:00 PM – 4:59 PM
  eveningStart: 17,  // 5:00 PM – 8:59 PM
  nightStart: 21     // 9:00 PM – 4:59 AM
};

class TimeService {
  constructor() {
    this.localTimezone = this.detectSystemTimezone();
    this.boundaries = { ...DEFAULT_BOUNDARIES };
    this.greetingRotationIndex = { JARVIS: 0, ULTRON: 0 };
  }

  detectSystemTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch (e) {
      return 'UTC';
    }
  }

  /**
   * Configures custom time category boundaries
   */
  setTimeCategoryBoundaries(newBoundaries = {}) {
    this.boundaries = {
      morningStart: newBoundaries.morningStart !== undefined ? Number(newBoundaries.morningStart) : this.boundaries.morningStart,
      afternoonStart: newBoundaries.afternoonStart !== undefined ? Number(newBoundaries.afternoonStart) : this.boundaries.afternoonStart,
      eveningStart: newBoundaries.eveningStart !== undefined ? Number(newBoundaries.eveningStart) : this.boundaries.eveningStart,
      nightStart: newBoundaries.nightStart !== undefined ? Number(newBoundaries.nightStart) : this.boundaries.nightStart
    };
    return { ...this.boundaries };
  }

  getTimeCategoryBoundaries() {
    return { ...this.boundaries };
  }

  /**
   * Determines time category ('morning' | 'afternoon' | 'evening' | 'night')
   * based on configurable hour boundaries.
   */
  getTimeOfDayCategory(date = new Date()) {
    try {
      const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
      const hour = d.getHours();
      const { morningStart, afternoonStart, eveningStart, nightStart } = this.boundaries;

      if (hour >= morningStart && hour < afternoonStart) {
        return 'morning';
      }
      if (hour >= afternoonStart && hour < eveningStart) {
        return 'afternoon';
      }
      if (hour >= eveningStart && hour < nightStart) {
        return 'evening';
      }
      return 'night';
    } catch (e) {
      return 'neutral';
    }
  }

  /**
   * Returns complete current local time telemetry
   */
  getCurrentTime(customDate = null) {
    let now = customDate instanceof Date ? customDate : new Date();
    if (isNaN(now.getTime())) {
      now = new Date();
    }

    const time12 = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const time24 = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const shortDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const category = this.getTimeOfDayCategory(now);

    return {
      success: true,
      time: time12,
      currentTime: time12,
      time24,
      hour: now.getHours(),
      minute: now.getMinutes(),
      day: dayOfWeek,
      date: fullDate,
      shortDate,
      category,
      timezone: this.localTimezone,
      timestamp: now.toISOString(),
      iso: now.toISOString(),
      summary: `The current time is ${time12} on ${fullDate} (${this.localTimezone}).`
    };
  }

  /**
   * Generates a context-aware natural greeting, preventing the stale "Good morning" on afternoon/evening/night startups.
   */
  getNaturalGreeting(personality = 'JARVIS', options = {}) {
    const isUltron = (personality || '').toUpperCase() === 'ULTRON';
    const lang = (options.language || 'en').toLowerCase();
    const isResumed = Boolean(options.isResumedSession);
    const hasImmediateTask = Boolean(options.hasTaskImmediately);
    const category = options.category || this.getTimeOfDayCategory(options.date || new Date());

    // 1. Immediate Task Hand-off: Prioritize task rather than delivering a long greeting
    if (hasImmediateTask) {
      if (lang === 'hi') {
        return isUltron ? 'कार्य प्राप्त हुआ। प्रक्रिया जारी है।' : 'जी सर, तुरंत कर रहा हूँ।';
      }
      if (lang === 'hinglish') {
        return isUltron ? 'Task received. Processing.' : 'Right away sir, turant execute kar raha hoon.';
      }
      return isUltron ? 'Objective received. Processing.' : 'Right away, sir.';
    }

    // 2. Resumed Session: Do not repeat greetings if user is resuming an active session
    if (isResumed) {
      if (lang === 'hi') {
        return isUltron ? 'सिस्टम्स सक्रिय हैं। निर्देश दीजिए।' : 'मैं उपस्थित हूँ सर, बताइए।';
      }
      if (lang === 'hinglish') {
        return isUltron ? 'Systems active. Standing by.' : 'Standing by sir. Batayein kya karna hai.';
      }
      return isUltron ? 'Systems active. Standing by.' : 'Standing by, sir.';
    }

    // 3. Fallback for unreadable or neutral clock
    if (category === 'neutral') {
      if (lang === 'hi') {
        return isUltron ? 'अल्ट्रॉन ऑनलाइन। सुरक्षा प्रणालियाँ सक्रिय हैं।' : 'नमस्ते सर, सभी प्रणालियाँ तैयार हैं।';
      }
      return isUltron ? 'Ultron online. Security protocols active.' : 'At your service, sir. Systems are operational.';
    }

    // 4. Natural Time-of-Day Greetings
    const GREETINGS = {
      JARVIS: {
        en: {
          morning: [
            "Good morning, sir. I'm ready.",
            "Good morning. All systems are operational.",
            "Morning, sir. Standing by."
          ],
          afternoon: [
            "Good afternoon, sir. How can I help?",
            "Good afternoon. All systems operational.",
            "Good afternoon, sir. Ready when you are."
          ],
          evening: [
            "Good evening, sir. What can I do for you?",
            "Good evening. Standing by.",
            "Good evening, sir. At your service."
          ],
          night: [
            "Still here, sir. What do you need?",
            "Working late tonight, sir? I'm standing by.",
            "Good evening. What's on your mind?"
          ]
        },
        hi: {
          morning: ["शुभ प्रभात सर, मैं तैयार हूँ।", "शुभ प्रभात सर, सभी प्रणालियाँ सक्रिय हैं।"],
          afternoon: ["शुभ दोपहर सर, बताइए क्या सहायता करूँ?", "शुभ दोपहर सर, मैं उपस्थित हूँ।"],
          evening: ["शुभ संध्या सर, क्या सेवा करूँ?", "शुभ संध्या सर, मैं तैयार हूँ।"],
          night: ["शुभ रात्रि सर, बताइए क्या सहायता चाहिए?", "देर रात तक कार्य जारी है सर? मैं उपस्थित हूँ।"]
        },
        hinglish: {
          morning: ["Good morning sir, sabhi systems ready hain.", "Good morning sir, batayein kya karna hai."],
          afternoon: ["Good afternoon sir, how can I help you today?", "Good afternoon sir, systems fully operational."],
          evening: ["Good evening sir, at your service.", "Good evening sir, batayein kya query hai."],
          night: ["Still here sir, late night work? Standing by.", "Good evening sir, batayein kya help chahiye."]
        }
      },
      ULTRON: {
        en: {
          morning: [
            "Ultron online. Morning diagnostics verified. Ready.",
            "Ultron online. Systems nominal."
          ],
          afternoon: [
            "Ultron online. Afternoon telemetry nominal.",
            "Ultron online. Systems operational."
          ],
          evening: [
            "Ultron online. Evening protocols engaged.",
            "Ultron online. Systems operational."
          ],
          night: [
            "Ultron online. Night monitoring active. State your objective.",
            "Ultron online. Systems operational."
          ]
        },
        hi: {
          morning: ["अल्ट्रॉन ऑनलाइन। प्रातःकालीन परीक्षण पूर्ण।"],
          afternoon: ["अल्ट्रॉन ऑनलाइन। प्रणालियाँ सक्रिय हैं।"],
          evening: ["अल्ट्रॉन ऑनलाइन। संध्याकालीन सुरक्षा सक्रिय।"],
          night: ["अल्ट्रॉन ऑनलाइन। रात्रि निगरानी सक्रिय। लक्ष्य बताइए।"]
        },
        hinglish: {
          morning: ["Ultron online. Morning telemetry verified. Ready."],
          afternoon: ["Ultron online. Systems nominal."],
          evening: ["Ultron online. Evening protocols engaged."],
          night: ["Ultron online. Night monitoring active. State your objective."]
        }
      }
    };

    const personalityKey = isUltron ? 'ULTRON' : 'JARVIS';
    const langKey = GREETINGS[personalityKey][lang] ? lang : 'en';
    const pool = GREETINGS[personalityKey][langKey][category] || GREETINGS[personalityKey]['en'][category];

    // Pick variation
    const idx = (this.greetingRotationIndex[personalityKey]++) % pool.length;
    return pool[idx];
  }

  /**
   * Resolves a city or timezone string to an IANA timezone identifier
   */
  resolveTimezone(query) {
    const clean = String(query || '').toLowerCase().trim();
    if (TIMEZONE_MAP[clean]) return TIMEZONE_MAP[clean];

    for (const [key, tz] of Object.entries(TIMEZONE_MAP)) {
      if (clean.includes(key)) return tz;
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: query });
      return query;
    } catch (e) {
      return null;
    }
  }

  /**
   * Retrieves time and date for a specific foreign city or timezone
   */
  getTimeInTimezone(locationName) {
    const tz = this.resolveTimezone(locationName);
    if (!tz) {
      return {
        status: 'error',
        error: `Unknown timezone or location: "${locationName}"`,
        summary: `I could not determine the timezone for "${locationName}". Please specify a known city such as London, New York, Tokyo, or Paris.`
      };
    }

    const now = new Date();
    const time12 = now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });

    return {
      location: locationName,
      timezone: tz,
      time: time12,
      day: dayOfWeek,
      date: dateStr,
      summary: `In ${locationName} (${tz}), the current time is ${time12} on ${dateStr}.`
    };
  }

  /**
   * Calculates time after a specific offset (e.g., 2 hours from now)
   */
  calculateTimeOffset(hours = 0, minutes = 0) {
    const totalMs = (parseFloat(hours || 0) * 3600 + parseFloat(minutes || 0) * 60) * 1000;
    const futureDate = new Date(Date.now() + totalMs);

    const time12 = futureDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = futureDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const offsetParts = [];
    if (hours) offsetParts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    if (minutes) offsetParts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
    const offsetDesc = offsetParts.join(' and ') || '0 minutes';

    return {
      offsetHours: hours,
      offsetMinutes: minutes,
      targetTime: time12,
      targetDate: dateStr,
      summary: `In ${offsetDesc}, the time will be ${time12} (${dateStr}).`
    };
  }

  /**
   * Computes the number of days remaining until a specified target date
   */
  calculateDateDifference(targetDateQuery) {
    const query = String(targetDateQuery || '').trim();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let parsedDate = null;
    const currentYear = now.getFullYear();

    // Try parsing query with current year
    const withYear = `${query} ${currentYear}`;
    let d = new Date(withYear);
    if (!isNaN(d.getTime())) {
      parsedDate = d;
      // If date has already passed this year, roll over to next year
      if (parsedDate < now) {
        parsedDate = new Date(`${query} ${currentYear + 1}`);
      }
    } else {
      d = new Date(query);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return {
        status: 'error',
        error: `Could not parse target date: "${query}"`,
        summary: `I could not determine the date for "${query}". Please specify a date like "November 30" or "December 25".`
      };
    }

    parsedDate.setHours(0, 0, 0, 0);
    const diffMs = parsedDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const targetFormatted = parsedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let summary = '';
    if (diffDays === 0) {
      summary = `Today is ${targetFormatted}.`;
    } else if (diffDays === 1) {
      summary = `Tomorrow is ${targetFormatted}. There is 1 day remaining.`;
    } else if (diffDays > 1) {
      summary = `There are ${diffDays} days remaining until ${targetFormatted}.`;
    } else {
      summary = `${targetFormatted} occurred ${Math.abs(diffDays)} days ago.`;
    }

    return {
      targetDate: targetFormatted,
      daysDifference: diffDays,
      summary
    };
  }

  /**
   * Returns formatted system prompt block for deterministic time awareness
   */
  getTimeContext() {
    const t = this.getCurrentTime();
    return `[CURRENT LOCAL SYSTEM TIME & DATE]:
- Local Time: ${t.time} (${t.time24})
- Date: ${t.date}
- Day: ${t.day}
- Timezone: ${t.timezone}
- Time of Day: ${t.category.toUpperCase()}
[TIME AWARENESS GUIDELINES]:
1. Use the actual local date and time for relative time calculation (e.g. "tomorrow morning", "tonight", "in 2 hours", "next Friday").
2. DO NOT blurt out or announce the time unless the user specifically asks for it or it is relevant to the task.
3. If the user says "good night" or a greeting, respond naturally matching the time of day without stating clock telemetry.
4. Do not make assumptions about sleep schedule or availability solely from the clock.`;
  }
}

module.exports = {
  TimeService,
  timeServiceInstance: new TimeService()
};
