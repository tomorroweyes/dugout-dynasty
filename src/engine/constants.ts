export const GAME_CONSTANTS = {
  STARTING_CASH: 5000,
  STARTING_FANS: 1.0,


  MATCH_REWARDS: {
    BASE_WIN: 500,
    BASE_LOSS: 250,
  },

  VARIANCE: {
    MIN: 0.8,
    MAX: 1.2,
  },

  // Roster sizes scale with league tier - start small, grow over time
  // This creates player attachment and makes progression feel meaningful
  ROSTER_SIZES_BY_TIER: {
    SANDLOT: { batters: 4, starters: 1, relievers: 0 }, // 5 total - minimum real lineup
    LOCAL: { batters: 4, starters: 1, relievers: 1 }, // 6 total - add first reliever
    REGIONAL: { batters: 6, starters: 2, relievers: 1 }, // 9 total - add rotation depth
    NATIONAL: { batters: 8, starters: 2, relievers: 2 }, // 12 total - add bullpen
    WORLD: { batters: 12, starters: 2, relievers: 3 }, // 17 total - full MLB-style roster
  },

  // Legacy constant - kept for backward compatibility
  // New code should use ROSTER_SIZES_BY_TIER instead
  STARTER_ROSTER: {
    BATTERS: 4, // Default to SANDLOT size
    STARTERS: 1,
    RELIEVERS: 0,
  },

  LINEUP_SIZE: 12, // Max lineup size (WORLD tier)

  LINEUP_COMPOSITION: {
    BATTERS: 9,
    STARTERS: 1,
    RELIEVERS: 2,
  },

  // At-Bat Simulation Constants
  AT_BAT: {
    // Outcome probability modifiers
    STRIKEOUT_DIVISOR: 1.8, // Lower = more strikeouts
    STRIKEOUT_CONTROL_WEIGHT: 0.4, // How much control contributes to strikeouts (0 = none, 1 = same as velocity)
    WALK_WILDNESS_DIVISOR: 12, // Pitcher wildness: (100 - control) / divisor. Lower = more wild walks
    WALK_DISCIPLINE_DIVISOR: 20, // Batter discipline: (contact - threshold) / divisor. Lower = more disciplined walks
    WALK_DISCIPLINE_THRESHOLD: 40, // Contact must exceed this for batter discipline bonus

    // Score weights for ball-in-play outcomes
    BATTER_SCORE_MULTIPLIER: 1.2,
    PITCHER_SCORE_MULTIPLIER: 0.9,
    DEFENSE_SCORE_MULTIPLIER: 0.8,

    // Power bonus: shifts hit outcomes toward extra-base hits when batter makes contact
    // (power - 50) * weight, so average power (50) adds nothing, 80 power adds ~4.5 to hitRoll
    POWER_HIT_BONUS_WEIGHT: 0.15,

    // Net score limits (prevents extreme advantages)
    MAX_NET_SCORE: 15,
    MIN_NET_SCORE: -15,

    // Hit outcome thresholds (higher hitRoll = better outcome)
    HOMERUN_THRESHOLD: 98,
    TRIPLE_THRESHOLD: 95,
    DOUBLE_THRESHOLD: 85,
    SINGLE_THRESHOLD: 55,

    // Out type distribution (percentages)
    OUT_TYPES: {
      GROUNDOUT: 0.45, // 45% ground outs
      FLYOUT: 0.35, // 35% fly outs
      LINEOUT: 0.12, // 12% line outs
      POPOUT: 0.08, // 8% pop outs
    },
  },

  // Speed-based baserunning (extra base attempts)
  BASERUNNING: {
    // Base chance to attempt an extra base (before speed modifier)
    // Formula: attemptChance = BASE_ATTEMPT_CHANCE + (speed - 50) * SPEED_ATTEMPT_SCALE
    BASE_ATTEMPT_CHANCE: 15, // 15% base chance
    SPEED_ATTEMPT_SCALE: 0.5, // Each point of speed above 50 adds 0.5% attempt chance

    // Success chance when attempting extra base
    // Formula: successChance = BASE_SUCCESS_CHANCE + (speed - defenseGlove) * SPEED_SUCCESS_SCALE
    BASE_SUCCESS_CHANCE: 55, // 55% base success rate
    SPEED_SUCCESS_SCALE: 0.6, // Each point of speed vs glove advantage adds 0.6%

    // Min/max caps for attempt and success chances
    MIN_ATTEMPT_CHANCE: 5, // Even slow runners occasionally try
    MAX_ATTEMPT_CHANCE: 55, // Even elite speedsters don't always try
    MIN_SUCCESS_CHANCE: 25, // Always some chance of being safe
    MAX_SUCCESS_CHANCE: 90, // Never guaranteed safe

    // With 2 outs, runners are more aggressive (running on contact)
    TWO_OUT_ATTEMPT_BONUS: 15, // +15% attempt chance with 2 outs
  },

  // Ability Clash system (when both batter & pitcher use guaranteed outcomes)
  CLASH: {
    ENABLED: true,
    // Each side rolls: random() * their ability's power (successChance or max outcome chance)
    // Higher roll wins and their outcome resolves; loser's ability is negated
  },

  // Pitcher fatigue system (within-game)
  PITCHER_FATIGUE: {
    EFFECTIVENESS_LOSS_PER_INNING: 0.08, // 8% per inning — meaningful degradation by inning 6+
    MINIMUM_EFFECTIVENESS: 0.55, // Can't drop below 55% — creates real reason to pull starters
  },

  // Pitcher rotation (when to substitute pitchers)
  PITCHER_ROTATION: {
    STARTER_MAX_INNINGS: 5,
    FIRST_RELIEVER_INNING: 5,
    SECOND_RELIEVER_INNING: 7,
  },

  // Opponent team generation
  OPPONENT: {
    STRENGTH_VARIANCE_MIN: 0.9,
    STRENGTH_VARIANCE_MAX: 1.1,
  },


  // League System - tier-based progression
  LEAGUE_TIERS: {
    SANDLOT: {
      name: "Sandlot League",
      numTeams: 4, // Smaller leagues in lower tiers
      gamesPerOpponent: 3, // 9-game season

      opponentStrength: {
        min: 0.95, // Equal footing - slight variance
        max: 1.05,
      },

      rewards: {
        championshipCash: 2000,
        topHalfCash: 1000,
        scoutPointsPerWin: 1,
        fanMultiplierGrowth: 0.05, // +5% per win
      },

      matchRewards: {
        win: 500,
        loss: 200,
      },

      // Promotion: Top 2 advance
      promotionSlots: 2,
      relegationSlots: 0, // Can't go lower than sandlot
    },

    LOCAL: {
      name: "Local League",
      numTeams: 6,
      gamesPerOpponent: 2, // 10-game season

      opponentStrength: {
        min: 1.0, // Slightly tougher competition
        max: 1.1,
      },

      rewards: {
        championshipCash: 5000,
        topHalfCash: 2500,
        scoutPointsPerWin: 2,
        fanMultiplierGrowth: 0.07,
      },

      matchRewards: {
        win: 1000,
        loss: 400,
      },

      promotionSlots: 2,
      relegationSlots: 2,
    },

    REGIONAL: {
      name: "Regional League",
      numTeams: 8,
      gamesPerOpponent: 2, // 14-game season

      opponentStrength: {
        min: 1.05, // Noticeably stronger opponents
        max: 1.2,
      },

      rewards: {
        championshipCash: 10000,
        topHalfCash: 5000,
        scoutPointsPerWin: 3,
        fanMultiplierGrowth: 0.1,
      },

      matchRewards: {
        win: 2000,
        loss: 800,
      },

      promotionSlots: 2,
      relegationSlots: 2,
    },

    NATIONAL: {
      name: "National League",
      numTeams: 10,
      gamesPerOpponent: 2, // 18-game season

      opponentStrength: {
        min: 1.15, // Significantly tougher
        max: 1.3,
      },

      rewards: {
        championshipCash: 20000,
        topHalfCash: 10000,
        scoutPointsPerWin: 5,
        fanMultiplierGrowth: 0.12,
      },

      matchRewards: {
        win: 4000,
        loss: 1500,
      },

      promotionSlots: 2,
      relegationSlots: 2,
    },

    WORLD: {
      name: "World Championship",
      numTeams: 12,
      gamesPerOpponent: 2, // 22-game season

      opponentStrength: {
        min: 1.25, // Elite competition - very challenging
        max: 1.5,
      },

      rewards: {
        championshipCash: 50000,
        topHalfCash: 25000,
        scoutPointsPerWin: 10,
        fanMultiplierGrowth: 0.15,
      },

      matchRewards: {
        win: 8000,
        loss: 3000,
      },

      promotionSlots: 0, // Top tier, nowhere to promote
      relegationSlots: 3, // Harsh competition
    },
  },

  // Patient approach fatigue effect (wears down opposing pitcher)
  PATIENT_FATIGUE: {
    FATIGUE_EFFECT_PER_AT_BAT: 0.15, // Each Patient at-bat = 0.15 extra fatigue innings on opposing pitcher
  },

  // Paint strategy fatigue cost (exhausting to sustain precision)
  PAINT_FATIGUE: {
    FATIGUE_COST_PER_AT_BAT: 0.2, // Each Paint at-bat costs the pitcher 0.2 extra fatigue innings
  },

  // Spirit momentum — spirit flows with in-game performance
  SPIRIT_MOMENTUM: {
    // Batting (applied to the batter)
    SINGLE: 4,
    DOUBLE: 6,
    TRIPLE: 8,
    HOMERUN: 10,
    RBI_BONUS: 3,
    WALK: 2,
    STRIKEOUT: -3,

    // Team-wide bonus when any run scores
    TEAM_RUN_SCORED: 2,

    // Pitching (applied to the pitcher)
    PITCH_STRIKEOUT: 5,
    PITCH_GROUNDOUT: 2,
    PITCH_FLYOUT: 2,
    PITCH_LINEOUT: 2,
    PITCH_POPOUT: 2,
    PITCH_HIT_ALLOWED: -2,
    PITCH_WALK_ALLOWED: -3,
    PITCH_RUN_ALLOWED: -5,
    PITCH_HR_ALLOWED: -8,
  },

  // Adaptation — DISABLED (penalty scale removed)
  // Previously penalized consecutive same-approach/strategy use, but this forced
  // unnatural rotation and conflicted with strategic depth (e.g., wearing down a
  // pitcher with "patient" approach). Now all approaches are equal weight.
  ADAPTATION: {
    PENALTY_SCALE: [1.0, 1.0, 1.0, 1.0, 1.0] as readonly number[],
  },

  // AI Personality Presets - creates variation in AI behavior
  AI_PERSONALITIES: {
    AGGRESSIVE: {
      aggression: 0.8,
      depthFocus: 0.3,
      restDiscipline: 0.4,
    },
    BALANCED: {
      aggression: 0.5,
      depthFocus: 0.5,
      restDiscipline: 0.7,
    },
    CONSERVATIVE: {
      aggression: 0.2,
      depthFocus: 0.7,
      restDiscipline: 0.9,
    },
    STAR_DRIVEN: {
      aggression: 0.9,
      depthFocus: 0.2,
      restDiscipline: 0.3,
    },
    DEPTH_FOCUSED: {
      aggression: 0.3,
      depthFocus: 0.9,
      restDiscipline: 0.8,
    },
  },
};
