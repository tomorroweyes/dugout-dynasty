export const GAME_CONSTANTS = {
  STARTING_CASH: 5000,
  STARTING_FANS: 1.0,

  MATCH_COSTS: {
    STAMINA_DRAIN: 15,
    STAMINA_RECOVERY: 20,
  },

  STAMINA_PENALTY_THRESHOLD: 50,
  STAMINA_PENALTY_MULTIPLIER: 0.75, // Reduced from 0.5 - tired players are 25% worse, not 50%

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

  // At-Bat Simulation Constants
  AT_BAT: {
    // Outcome probability modifiers
    STRIKEOUT_DIVISOR: 1.8, // Lower = more strikeouts
    STRIKEOUT_CONTROL_WEIGHT: 0.4, // How much control contributes to strikeouts (0 = none, 1 = same as velocity)
    WALK_WILDNESS_DIVISOR: 12, // Pitcher wildness: (100 - control) / divisor
    WALK_DISCIPLINE_DIVISOR: 20, // Batter discipline: (contact - threshold) / divisor
    WALK_DISCIPLINE_THRESHOLD: 40, // Contact must exceed this for batter discipline bonus

    // Score weights for ball-in-play outcomes
    BATTER_SCORE_MULTIPLIER: 1.2,
    PITCHER_SCORE_MULTIPLIER: 0.9,
    DEFENSE_SCORE_MULTIPLIER: 0.8,

    // Power bonus: shifts hit outcomes toward extra-base hits when batter makes contact
    POWER_HIT_BONUS_WEIGHT: 0.15,

    // Net score limits (prevents extreme advantages)
    MAX_NET_SCORE: 15,
    MIN_NET_SCORE: -15,

    // Hit outcome thresholds (higher hitRoll = better outcome)
    HOMERUN_THRESHOLD: 90,
    TRIPLE_THRESHOLD: 82,
    DOUBLE_THRESHOLD: 70,
    SINGLE_THRESHOLD: 60,
  },

  // Pitcher fatigue system (within-game)
  PITCHER_FATIGUE: {
    EFFECTIVENESS_LOSS_PER_INNING: 0.05, // 5% per inning
    MINIMUM_EFFECTIVENESS: 0.7, // Can't drop below 70%
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
};
