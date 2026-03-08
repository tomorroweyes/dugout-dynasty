/**
 * Opponent Reputation & Adaptation System
 *
 * Opponents build intelligence on players over time. High-use habits and
 * active Signature Skills become known. Scout tier gates how they adapt.
 *
 * Scout Tiers:
 *   0 (Unknown)    — First encounter, no intel
 *   1 (Familiar)   — 3+ games vs same opponent, knows top habit (strength > 75)
 *   2 (Scouted)    — Mid-season (game 10+), knows top habit + signature name
 *   3 (Game-planned) — Playoffs or 2nd season, full habit profile + counter
 *
 * See GitHub issue #31.
 */

import type { Player } from "@/types/game";
import type { OpponentIntel, OpponentAdaptation, ScoutTier } from "@/types/reputation";
import {
  SCOUT_TIER_THRESHOLDS,
  ADAPTATION_EFFECT,
} from "@/types/reputation";
import { getActiveHabits } from "./badHabitSystem";
import { getActiveSignatureSkill } from "./signatureSkillSystem";
import { randomChoice } from "./textPools";
import {
  SCOUT_INFIELD_SHIFT_TEXTS,
  SCOUT_SIGNATURE_COUNTER_TEXTS,
  SCOUT_FULL_GAMEPLAN_TEXTS,
  SCOUT_OFFSEASON_RESET_TEXTS,
} from "./narrative/situationalPools";

// ---------------------------------------------------------------------------
// Intel Management
// ---------------------------------------------------------------------------

/**
 * Get or create the intel record for a specific opponent.
 * Mutates player.opponentIntel in place.
 */
export function getOrCreateOpponentIntel(
  player: Player,
  opponentId: string,
  opponentName: string,
  currentSeason: number
): OpponentIntel {
  if (!player.opponentIntel) {
    player.opponentIntel = [];
  }

  const existing = player.opponentIntel.find((r) => r.opponentId === opponentId);
  if (existing) {
    return existing;
  }

  const fresh: OpponentIntel = {
    opponentId,
    opponentName,
    gamesPlayed: 0,
    currentSeasonGames: 0,
    scoutTier: 0,
    knownHabitIds: [],
    counterStrategies: [],
    lastMetSeason: currentSeason,
  };

  player.opponentIntel.push(fresh);
  return fresh;
}

/**
 * Record that a game was played vs this opponent.
 * Updates game counts and re-calculates the scout tier.
 *
 * @param player        - The player (their perspective)
 * @param opponentId    - Unique team identifier
 * @param opponentName  - Human-readable team name
 * @param currentSeason - Current season number
 * @param isPlayoffs    - Whether this is a playoff game (can unlock Tier 3)
 * @param totalSeasonGamesPlayed - How many games into the season it is (≥10 unlocks Tier 2)
 */
export function recordGameVsOpponent(
  player: Player,
  opponentId: string,
  opponentName: string,
  currentSeason: number,
  isPlayoffs: boolean = false,
  totalSeasonGamesPlayed: number = 0
): OpponentIntel {
  const intel = getOrCreateOpponentIntel(player, opponentId, opponentName, currentSeason);

  intel.gamesPlayed += 1;
  intel.currentSeasonGames += 1;
  intel.lastMetSeason = currentSeason;

  // Recalculate scout tier
  intel.scoutTier = calculateScoutTier(
    intel,
    currentSeason,
    isPlayoffs,
    totalSeasonGamesPlayed
  );

  // Update known habits at the new tier
  updateKnownHabits(intel, player);
  updateKnownSignature(intel, player);

  return intel;
}

// ---------------------------------------------------------------------------
// Scout Tier Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate scout tier based on history and current game context.
 */
export function calculateScoutTier(
  intel: OpponentIntel,
  currentSeason: number,
  isPlayoffs: boolean,
  totalSeasonGamesPlayed: number
): ScoutTier {
  const isSecondSeason = intel.lastMetSeason < currentSeason && intel.gamesPlayed > 0;

  // Tier 3: playoffs or facing this opponent in a 2nd+ season
  if (isPlayoffs || isSecondSeason) {
    return 3;
  }

  // Tier 2: mid-season (≥10 games into the season) and 3+ games vs opponent
  if (
    totalSeasonGamesPlayed >= SCOUT_TIER_THRESHOLDS.tier2SeasonGame &&
    intel.currentSeasonGames >= SCOUT_TIER_THRESHOLDS.tier1GamesRequired
  ) {
    return 2;
  }

  // Tier 1: 3+ games vs this opponent
  if (intel.currentSeasonGames >= SCOUT_TIER_THRESHOLDS.tier1GamesRequired) {
    return 1;
  }

  // Tier 0: still unknown
  return 0;
}

// ---------------------------------------------------------------------------
// Intel Updates
// ---------------------------------------------------------------------------

/**
 * Update the set of habits this opponent knows about, based on scout tier.
 */
function updateKnownHabits(intel: OpponentIntel, player: Player): void {
  if (intel.scoutTier < 1) {
    return; // Tier 0 knows nothing
  }

  const activeHabits = getActiveHabits(player);

  if (intel.scoutTier === 1) {
    // Tier 1: know top habit only if strength > 75
    const topHabit = activeHabits
      .filter((h) => h.strength > SCOUT_TIER_THRESHOLDS.tier1HabitStrengthRequired)
      .sort((a, b) => b.strength - a.strength)[0];

    if (topHabit && !intel.knownHabitIds.includes(topHabit.habitId)) {
      intel.knownHabitIds.push(topHabit.habitId);
    }
  } else if (intel.scoutTier >= 2) {
    // Tier 2+: know all active habits
    for (const habit of activeHabits) {
      if (!intel.knownHabitIds.includes(habit.habitId)) {
        intel.knownHabitIds.push(habit.habitId);
      }
    }

    // Tier 3: add counter strategies
    if (intel.scoutTier === 3 && intel.counterStrategies.length === 0) {
      intel.counterStrategies.push("Exploit pull tendency — shift infield right");
      intel.counterStrategies.push("Avoid signature zone — pitch opposite side");
    }
  }
}

/**
 * Update whether this opponent knows about the player's signature skill.
 */
function updateKnownSignature(intel: OpponentIntel, player: Player): void {
  if (intel.scoutTier < 2) {
    intel.knownSignatureName = undefined;
    return;
  }

  const sig = getActiveSignatureSkill(player);
  if (sig) {
    intel.knownSignatureName = sig.skillName;
  }
}

// ---------------------------------------------------------------------------
// Adaptation Calculation
// ---------------------------------------------------------------------------

/**
 * Given player state and opponent intel, calculate what adaptations the
 * opponent applies this AB.
 *
 * @param player     - The batter/pitcher being adapted against
 * @param intel      - The opponent's intel record for this player
 * @returns OpponentAdaptation describing what the opponent does
 */
export function calculateOpponentAdaptation(
  player: Player,
  intel: OpponentIntel
): OpponentAdaptation {
  const adaptation: OpponentAdaptation = {
    infielderShift: false,
    offSpeedBias: false,
    signatureCountered: false,
    fullCounter: false,
  };

  if (intel.scoutTier === 0) {
    return adaptation; // No intel — no adaptation
  }

  const activeHabits = getActiveHabits(player);

  // Tier 1+: Pull-Happy → infield shift
  const hasPullHappy = activeHabits.some(
    (h) => h.habitType === "pull_happy" && intel.knownHabitIds.includes(h.habitId)
  );
  if (hasPullHappy && intel.scoutTier >= 1) {
    adaptation.infielderShift = true;
  }

  // Tier 1+: Chase Artist → off-speed bias
  const hasChaseArtist = activeHabits.some(
    (h) => h.habitType === "chase_artist" && intel.knownHabitIds.includes(h.habitId)
  );
  if (hasChaseArtist && intel.scoutTier >= 1) {
    adaptation.offSpeedBias = true;
  }

  // Tier 2+: Telegraphed → signature countered
  if (intel.scoutTier >= 2 && intel.knownSignatureName) {
    const sig = getActiveSignatureSkill(player);
    if (sig && sig.skillName === intel.knownSignatureName) {
      adaptation.signatureCountered = true;
    }
  }

  // Tier 3: Full counter
  if (intel.scoutTier === 3) {
    adaptation.fullCounter = true;
  }

  adaptation.adaptationNarrative = buildAdaptationNarrative(adaptation, player.name);

  return adaptation;
}

/**
 * Apply the reputation adaptation penalty to a hit probability value.
 * Returns the adjusted hit probability.
 */
export function applyReputationPenalty(
  baseHitProb: number,
  adaptation: OpponentAdaptation
): number {
  let prob = baseHitProb;

  if (adaptation.infielderShift) {
    prob -= ADAPTATION_EFFECT.pullHabitHitReduction; // −15%
  }

  if (adaptation.fullCounter) {
    prob -= ADAPTATION_EFFECT.tier3SignatureExtra; // −5%
  }

  return Math.max(0, Math.min(1, prob));
}

/**
 * Apply reputation penalty to signature skill effectiveness.
 * Returns the adjusted effectiveness.
 */
export function applySignatureReputationPenalty(
  baseEffect: number,
  adaptation: OpponentAdaptation
): number {
  if (!adaptation.signatureCountered) {
    return baseEffect;
  }

  return Math.max(0, baseEffect - ADAPTATION_EFFECT.signatureEffectReduction); // −10%
}

// ---------------------------------------------------------------------------
// Reputation Resets
// ---------------------------------------------------------------------------

/**
 * Off-season reputation decay: Tier 3 → Tier 1.
 * Tier 0, 1, 2 are unchanged.
 */
export function applyOffSeasonReputationDecay(player: Player): void {
  if (!player.opponentIntel) {
    return;
  }

  for (const intel of player.opponentIntel) {
    if (intel.scoutTier === 3) {
      intel.scoutTier = 1;
      // Keep some knowledge but clear counter strategies
      intel.counterStrategies = [];
      intel.currentSeasonGames = 0;
    } else {
      intel.currentSeasonGames = 0;
    }
  }
}

/**
 * Reinvention arc reset: all opponents → Tier 0.
 * Called from reinventionSystem when reinvention is triggered.
 */
export function applyReinventionReputationReset(player: Player): string[] {
  if (!player.opponentIntel) {
    return [];
  }

  const resetOpponents: string[] = [];

  for (const intel of player.opponentIntel) {
    if (intel.scoutTier > 0) {
      resetOpponents.push(intel.opponentName);
    }
    intel.scoutTier = 0;
    intel.knownHabitIds = [];
    intel.knownSignatureName = undefined;
    intel.counterStrategies = [];
  }

  return resetOpponents;
}

/**
 * Trade reset: all opponents → Tier 0 (new team, new opponents).
 */
export function applyTradeReputationReset(player: Player): void {
  player.opponentIntel = [];
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

function buildAdaptationNarrative(
  adaptation: OpponentAdaptation,
  playerName: string
): string | undefined {
  if (adaptation.fullCounter) {
    const template = randomChoice(SCOUT_FULL_GAMEPLAN_TEXTS);
    return template.replace(/{playerName}/g, playerName);
  }

  if (adaptation.signatureCountered) {
    const template = randomChoice(SCOUT_SIGNATURE_COUNTER_TEXTS);
    return template.replace(/{playerName}/g, playerName);
  }

  if (adaptation.infielderShift) {
    const template = randomChoice(SCOUT_INFIELD_SHIFT_TEXTS);
    return template.replace(/{playerName}/g, playerName);
  }

  return undefined;
}

/** Narrative when off-season reset fires */
export function narrativeOffSeasonReset(playerName: string): string {
  const template = randomChoice(SCOUT_OFFSEASON_RESET_TEXTS);
  return template.replace(/{playerName}/g, playerName);
}
