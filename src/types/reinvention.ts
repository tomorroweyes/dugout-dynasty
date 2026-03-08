/**
 * Reinvention Arc System — Phase 4
 *
 * A veteran player sheds their identity, archives their Signature Skill,
 * resets opponent intelligence, and enters a season of transition.
 *
 * Trigger: age 29+ OR 7+ seasons played, has Signature Skill, no prior reinvention.
 * Effect: −10% physical effectiveness, +20% mental XP for 1 season.
 *
 * See GitHub issue #34.
 */

export interface ReinventionEvent {
  reinventionId: string;
  playerId: string;
  triggeredAt: {
    season: number;
    gameNumber: number; // 0 if triggered off-season
  };
  /** ID of the Signature Skill archived on reinvention */
  archivedSignatureId: string;
  /** Habit IDs that were reset to strength 0 */
  resetHabits: string[];
  /** Opponent names whose intel was reset to Tier 0 */
  resetOpponents: string[];
  /** Arc progress: set immediately to "in_progress", resolved at season end */
  outcome: "in_progress" | "success" | "failure";
  /** Populated when resolveReinventionOutcome is called */
  resolvedAt?: {
    season: number;
    finalAvg: number;
  };
}

export interface ReinventionModifiers {
  /** Physical effectiveness multiplier (0.90 = −10%) */
  physicalMultiplier: number;
  /** Mental skill XP multiplier (1.20 = +20%) */
  mentalXpMultiplier: number;
  /** Season number after which modifiers expire (reinvention season + 1) */
  expiresAfterSeason: number;
}

/**
 * Threshold for reinvention success (batting average)
 * > 0.220 avg in the reinvention season = success
 */
export const REINVENTION_SUCCESS_AVG_THRESHOLD = 0.220;

/** Physical effectiveness modifier during reinvention season */
export const REINVENTION_PHYSICAL_MULTIPLIER = 0.90;

/** Mental XP bonus multiplier during reinvention season */
export const REINVENTION_MENTAL_XP_MULTIPLIER = 1.20;

/** Minimum age for reinvention eligibility */
export const REINVENTION_MIN_AGE = 29;

/** Minimum seasons played for reinvention eligibility */
export const REINVENTION_MIN_SEASONS = 7;
