/**
 * ULTRON × JARVIS — Dual AI Ocular System Configuration
 * Centralized theme palettes, background atmospheric lighting, and voice controls.
 */

export const CONFIG = {
  // Rendering
  targetFPS: 60,
  maxDPR: 1.0,

  // Dual AI Themes: ULTRON (Default Crimson) & JARVIS (Ocean Blue)
  themes: {
    ULTRON: {
      name: 'ULTRON',
      displayName: 'AI CORE // ULTRON',
      subText: 'CRIMSON SECURITY PROTOCOL',
      dotColor: '#ef4444',
      
      // Iris Base Gradient (Deep Charcoal & Obsidian)
      irisBase: {
        center: '#040206',
        inner: '#0b0711',
        mid: '#160e1d',
        outer: '#0d0714',
        limbus: '#030105'
      },

      // Radial Fibers (Crimson / Oxblood / Charcoal)
      charcoalFiber: { min: 28, max: 55, rDelta: 0, gDelta: -4, bDelta: 6 },
      accentFiber: {
        rMin: 65, rMax: 105,
        gMin: 10, gMax: 24,
        bMin: 18, bMax: 34,
        alphaMin: 0.16, alphaMax: 0.45
      },

      // Iris Structures & Speculars
      collarette: 'rgba(82, 18, 30, 0.45)', // Deep wine crimson
      contractionRing: 'rgba(62, 16, 28, 0.32)',
      pupillaryRuff: 'rgba(48, 10, 20, 0.60)',
      ambientGlow: 'rgba(90, 16, 28, 0.16)',
      screenReflectionTint: 'rgba(235, 220, 235, 0.20)',

      // Background Atmospheric Atmosphere (Deep Purple-Black)
      background: {
        gradCenter: [28, 10, 50],   // #1c0a32
        gradInner:  [15, 6, 28],    // #0f061c
        gradMid:    [6, 3, 14],     // #06030e
        gradOuter:  [2, 1, 4],      // #020104
        eyeAura:    [85, 14, 32, 0.22], // Deep crimson aura behind eye
        scanline:   [180, 40, 70, 0.025],
        codeAccent: [230, 60, 85],   // Crimson security code lines
        codeTelemetry: [192, 132, 252] // Violet telemetry
      }
    },

    JARVIS: {
      name: 'JARVIS',
      displayName: 'AI CORE // JARVIS',
      subText: 'OCEAN INTELLIGENCE PROTOCOL',
      dotColor: '#38bdf8',

      // Iris Base Gradient (Deep Ocean Water under dim light)
      irisBase: {
        center: '#020408',
        inner: '#050e18',
        mid: '#091826',
        outer: '#050f1a',
        limbus: '#020407'
      },

      // Radial Fibers (Deep Ocean Blue / Teal / Muted Cyan / Slate Navy)
      charcoalFiber: { min: 24, max: 50, rDelta: -4, gDelta: 4, bDelta: 14 },
      accentFiber: {
        rMin: 16, rMax: 34,
        gMin: 72, gMax: 122,
        bMin: 125, bMax: 175,
        alphaMin: 0.16, alphaMax: 0.45
      },

      // Iris Structures & Speculars
      collarette: 'rgba(20, 78, 98, 0.45)', // Deep ocean teal-cyan
      contractionRing: 'rgba(18, 62, 85, 0.32)',
      pupillaryRuff: 'rgba(12, 42, 60, 0.60)',
      ambientGlow: 'rgba(20, 75, 115, 0.18)',
      screenReflectionTint: 'rgba(215, 235, 255, 0.22)',

      // Background Atmospheric Atmosphere (Deep Midnight-Ocean Palette)
      background: {
        gradCenter: [4, 22, 42],    // #04162a (deep midnight ocean navy)
        gradInner:  [3, 13, 26],    // #030d1a
        gradMid:    [2, 7, 16],     // #020710
        gradOuter:  [1, 3, 6],      // #010306
        eyeAura:    [16, 92, 138, 0.25], // Subtle blue/teal illumination behind eye
        scanline:   [56, 189, 248, 0.035],
        codeAccent: [56, 189, 248],  // Ocean cyan code lines
        codeTelemetry: [45, 212, 191] // Muted teal telemetry
      }
    }
  },

  // Theme Transition Animation
  transition: {
    durationMs: 1100, // 1100ms smooth organic interpolation
    defaultTheme: 'JARVIS'
  },

  // Cinematic Personality Switch Transition (Close Old Eye -> Pure Darkness -> Initialize Target -> Open New Eye)
  personalitySwitch: {
    durationMs: 3800,        // Total switch transition duration (~3.8s)
    phaseACloseMs: 1500,     // Phase A: Old eye closes naturally (0 - 1.5s)
    phaseBDarknessMs: 600,   // Phase B: Pure pitch darkness (1.5s - 2.1s)
    phaseCInitMs: 1800,      // Phase C: Switch personality internally at 1.8s while screen is 100% pitch black
    phaseDOpenMs: 1700       // Phase D: New eye slowly emerges & opens (2.1s - 3.8s)
  },

  // Deterministic Local Time & Configurable Boundaries
  time: {
    boundaries: {
      morningStart: 5,    // 5:00 AM – 11:59 AM
      afternoonStart: 12, // 12:00 PM – 4:59 PM
      eveningStart: 17,   // 5:00 PM – 8:59 PM
      nightStart: 21      // 9:00 PM – 4:59 AM
    },
    recheckIntervalMs: 60000 // Rollover verification interval
  },

  // AI Voice Personality Speech Synthesis (Web Speech API)
  speech: {
    enabled: true,
    delayMs: 60,  // Immediate speech dispatch without artificial delay
    JARVIS: {
      firstGreeting: "At your service, sir. Systems are operational.",
      subsequentGreeting: "Yes, sir. I'm listening.",
      sleepGreeting: "Of course, sir. Standing by in the background.",
      preferredLang: 'en-GB',
      rate: 1.02,   // Crisp, articulate, futuristic synthetic cadence
      pitch: 1.03,  // Controlled, subtly resonant British AI character
      volume: 1.0
    },
    ULTRON: {
      firstGreeting: "Ultron online. Security protocols active. I am listening.",
      subsequentGreeting: "Security protocols active. I am listening.",
      sleepGreeting: "Entering standby. Systems monitoring.",
      preferredLang: 'en-US',
      rate: 0.93,   // Deliberate mechanical cadence with crisp consonants
      pitch: 0.80,  // Deep, authoritative synthetic male resonance without guttural slurring
      volume: 1.0
    }
  },

  // Cinematic Visual Lifecycle Parameters (Sleep & Wake-Up)
  visualLifecycle: {
    JARVIS: {
      sleepDurationMs: 1200,
      phase1RealizeMs: 300,
      phase2CloseMs: 600,
      phase3FadeMs: 300,
      wakeDurationMs: 600,
      wakePhase1DetectMs: 100,
      wakePhase2GlowMs: 200,
      wakePhase3OpenMs: 300,
      wakePhase4FullMs: 100,
      glowColor: [56, 189, 248], // Ocean Cyan
      darkBg: '#010206'
    },
    ULTRON: {
      sleepDurationMs: 1200,
      phase1RealizeMs: 300,
      phase2CloseMs: 600,
      phase3FadeMs: 300,
      wakeDurationMs: 600,
      wakePhase1DetectMs: 100,
      wakePhase2GlowMs: 200,
      wakePhase3OpenMs: 300,
      wakePhase4FullMs: 100,
      glowColor: [239, 68, 68], // Crimson Red
      darkBg: '#020104'
    }
  },

  // Legacy state timing references for backwards compatibility
  states: {
    wakeDurationMs: 600,
    sleepDurationMs: 1200,
    idleSleepTimeoutMs: 600000 // 10 minutes to prevent unwanted dormancy
  },

  // Smart Conversational Session & Voice Activity Detection (VAD)
  session: {
    vadEnabled: true,
    adaptiveTimeoutEnabled: true,
    shortPauseGraceMs: 12000,          // 12s grace while user is mid-thought or pausing during utterance
    normalInactivityTimeoutMs: 45000,   // 45s of genuine silence before closing active conversational session
    extendedThinkingTimeoutMs: 90000,   // 90s grace if assistant asked a question or user says "let me think"
    maximumActiveSessionMs: 1800000,    // 30 min safety cutoff for abandoned continuous sessions
    speechEndDebounceMs: 400,           // 400ms silence threshold to mark completion of an utterance (responsive)
    energyThreshold: 0.0055,            // Calibrated RMS energy threshold for detecting quiet/whispered speech
    noiseFloorAdaptRate: 0.04,          // Adaptive background noise floor tracking rate
    spectralCentroidMinHz: 90,          // Covers natural male fundamentals down to 90Hz (was 220Hz)
    spectralCentroidMaxHz: 3800,        // Upper speech formant cutoff to reject HF clicks/fan whine
    quietSensitivityBoost: true,        // Enable speech-band filtering for whisper/quiet voice boost
    tolerateThinkingPauses: true,       // Allow extended pauses without session closure
    waitForFollowupAnswers: true        // Extend timeout when assistant ends turn with a question
  },

  // Shared Eye Geometry (Exact reference match)
  eye: {
    widthPercent: 0.76,     // Eye spans 76% of viewport width
    minWidth: 640,
    maxWidth: 1440,
    aspectRatio: 3.48,      // Wide horizontal almond shape
    centerYOffset: 0.585,   // Lower-middle of screen
    
    irisRadiusRatio: 0.285, // Ratio of eye width
    pupilRadiusRatio: 0.30, // Ratio of iris radius (baseline)
    pupilMinRatio: 0.24,
    pupilMaxRatio: 0.38,
    
    upperLidApexX: 0.46,
    upperLidArch: 1.05,
    lowerLidLowestX: 0.54,
    lowerLidArch: 0.88
  },

  // Eyelid Blinking State Machine
  blink: {
    minInterval: 2800,
    maxInterval: 5600,
    closeDuration: 85,
    holdDuration: 28,
    openDuration: 155,
    doubleBlinkChance: 0.14,
    upperTravelRatio: 0.82,
    lowerTravelRatio: 0.18
  },

  // Gaze Tracking & Autonomous Scanning
  gaze: {
    mouseFollowDamping: 0.075,
    maxGazeDeviationX: 0.26,
    maxGazeDeviationY: 0.22,
    idleTimeoutMs: 2200,
    
    saccadeMinInterval: 1400,
    saccadeMaxInterval: 3400,
    microsaccadeRate: 0.08,
    microsaccadeAmp: 0.012
  },

  // Living Code Sclera Field
  codeField: {
    rowCount: 24,
    charWidthApprox: 10.0,
    fontSize: 9.0,
    baseDriftSpeed: 16,
    shimmerFrequency: 0.04,
    irisDarkeningRadiusRatio: 1.24
  }
};
