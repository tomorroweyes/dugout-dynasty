/**
 * Opponent Reputation & Adaptation System — Phase 4
 *
 * Opponents build intelligence on players over time. High-use signatures and
 * active bad habits become known. The Scout System (4 tiers) gates how much
 * opponents know and how they adapt.
 *
 * See GitHub issue #31.
 */

/**
 * Scout tier — how well an opponent knows a player.
 * 0=Unknown, 1=Familiar, 2=Scouted, 3=Game-planned
 */
export type ScoutTier = 0 | 1 | 2 | 3;

/**
 * Per-opponent intelligence record stored on the player.
 * One entry per team/opponent the player has faced.
 */
export interface OpponentIntel {
  opponentId: string;
  opponentName: string;
  /** Total games played vs this opponent (across all seasons) */
  gamesPlayed: number;
  /** Games played in the current season vs this opponent */
  currentSeasonGames: number;
  scoutTier: ScoutTier;
  /** Habit IDs this opponent has identified */
  knownHabitIds: string[];
  /** Signature skill name this opponent knows (Tier 2+) */
  knownSignatureName?: string;
  /** Counter strategies logged by this opponent (Tier 3) */
  counterStrategies: string[];
  /** Last season this opponent was faced */
  lastMetSeason: number;
}

/**
 * The combined adaptation penalties an opponent applies this AB.
 */
export interface OpponentAdaptation {
  /** Pull-Happy counter: infield shift applied (−15% hit on pull) */
  infielderShift: boolean;
  /** Chase Artist counter: more off-speed outside zone */
  offSpeedBias: boolean;
  /** Signature skill countered: −10% signature effectiveness */
  signatureCountered: boolean;
  /** Full Tier 3 counter: opponent plays +5% harder vs signature */
  fullCounter: boolean;
  /** Human-readable description for play-by-play */
  adaptationNarrative?: string;
}

// ---------------------------------------------------------------------------
// Scout tier thresholds
// ---------------------------------------------------------------------------

/**
 * Number of games vs same opponent to reach each scout tier (cumulative).
 * Tier 1: 3+ games
 * Tier 2: mid-season (game 10+) ← this uses season game count
 * Tier 3: 2nd season vs opponent OR playoffs (tracked separately)
 */
export const SCOUT_TIER_THRESHOLDS = {
  tier1GamesRequired: 3,    // 3+ cumulative games vs opponent
  tier2SeasonGame: 10,      // opponent has watched >= 10 season games total
  tier1HabitStrengthRequired: 75, // must have strength > 75 to be "known"
} as const;

/** Effect magnitudes for opponent adaptations */
export const ADAPTATION_EFFECT = {
  pullHabitHitReduction: 0.15,     // Pull-Happy: −15% hit probability
  signatureEffectReduction: 0.10,  // Telegraphed: −10% signature effectiveness
  tier3SignatureExtra: 0.05,        // Tier 3: opponent plays +5% harder vs signature
} as const;
