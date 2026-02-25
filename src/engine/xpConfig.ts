/**
 * XP & Leveling Configuration
 *
 * Design Notes:
 * - Players start at level 3 for immediate customization
 * - Early levels are fast (hooks the player)
 * - Level 5 reachable in first 1-2 matches
 * - Late levels require sustained play
 * - Formula: XP_required = 100 × Level^1.5
 */

// ============================================
// XP CURVE
// ============================================

/**
 * Calculate XP required to reach the next level.
 *
 * Examples:
 * - Level 1→2: 100 XP
 * - Level 5→6: 1,118 XP
 * - Level 10→11: 3,162 XP
 * - Level 20→21: 8,944 XP
 * - Level 50→51: 35,355 XP
 */
export function calculateXpToNextLevel(currentLevel: number): number {
  return Math.floor(100 * Math.pow(currentLevel, 1.5));
}

/**
 * Calculate total XP needed to reach a specific level from level 1.
 * Useful for display purposes.
 */
export function calculateTotalXpForLevel(targetLevel: number): number {
  let total = 0;
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    total += calculateXpToNextLevel(lvl);
  }
  return total;
}

// ============================================
// XP REWARDS - BATTER ACTIONS
// ============================================

export const BATTER_XP_REWARDS = {
  // Hits - Higher XP for better outcomes
  SINGLE: 10,
  DOUBLE: 20,
  TRIPLE: 35,
  HOME_RUN: 50,

  // Plate discipline
  WALK: 5,

  // RBI bonus (per run batted in)
  RBI_BONUS: 5,

  // Scoring a run
  RUN_SCORED: 8,

  // Outs give nothing - they're not rewarded
  STRIKEOUT: 0,
  GROUND_OUT: 0,
  FLY_OUT: 0,
  LINE_OUT: 0,
  POP_OUT: 0,
} as const;

// ============================================
// XP REWARDS - PITCHER ACTIONS
// ============================================

export const PITCHER_XP_REWARDS = {
  // Per inning pitched — raised to keep pitchers level-competitive with batters
  INNING_PITCHED: 35,

  // Strikeouts are a pitcher's bread and butter
  STRIKEOUT: 15,

  // Clean inning bonus (no runs allowed)
  CLEAN_INNING_BONUS: 15,

  // Perfect inning (no baserunners)
  PERFECT_INNING_BONUS: 30,

  // Penalties (negative XP for poor performance)
  WALK_PENALTY: -2,
  HIT_ALLOWED_PENALTY: -1,
  RUN_ALLOWED_PENALTY: -5,
  HOME_RUN_ALLOWED_PENALTY: -10,
} as const;

// ============================================
// XP REWARDS - MATCH RESULTS
// ============================================

export const MATCH_XP_REWARDS = {
  // Win bonus applies to ALL players on roster
  WIN_BONUS: 100,

  // Consolation XP for losses (keeps progression moving)
  LOSS_CONSOLATION: 25,

  // Participation XP for being in lineup
  PARTICIPATION_BONUS: 10,

  // Bench players get reduced match XP (multiplied against win/loss bonus)
  BENCH_MULTIPLIER: 0.5,
} as const;

// ============================================
// LEVEL-UP STAT BONUSES
// ============================================

/**
 * Stat points awarded per level-up, by role.
 *
 * Design:
 * - Batters improve offense more
 * - Pitchers improve pitching more
 * - All players get small defensive improvements
 */
export const LEVEL_UP_STAT_BONUSES = {
  Batter: {
    power: 1.5, // Primary stat
    contact: 1.5, // Primary stat
    glove: 0.5, // Secondary stat
  },
  Starter: {
    velocity: 1.2,
    control: 1.2,
    break: 1.2,
  },
  Reliever: {
    velocity: 1.5, // Relievers specialize in velocity
    control: 1.0,
    break: 1.0,
  },
} as const;

// ============================================
// LEVEL CONSTANTS
// ============================================

export const LEVEL_CONSTANTS = {
  MIN_LEVEL: 1,
  MAX_LEVEL: 99,
  STARTING_LEVEL: 3, // Players start at level 3 for faster early progression
  STARTING_XP: 0,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

export type BatterOutcome = keyof typeof BATTER_XP_REWARDS;
export type PitcherOutcome = keyof typeof PITCHER_XP_REWARDS;
