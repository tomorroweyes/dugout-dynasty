/**
 * Reinvention Arc System
 *
 * Veteran players shed their identity: archive their Signature Skill,
 * reset opponent intelligence, and enter a season of physical decline
 * offset by accelerated mental growth.
 *
 * Trigger: age 29+ OR 7+ seasons, has Signature Skill, no prior reinvention.
 * Season effects: −10% physical, +20% mental XP.
 * Outcome: avg > 0.220 → success; ≤ 0.220 → failure + Veteran's Poise advance.
 *
 * See GitHub issue #34.
 */

import type { Player } from "@/types/game";
import type {
  ReinventionEvent,
  ReinventionModifiers,
} from "@/types/reinvention";
import {
  REINVENTION_SUCCESS_AVG_THRESHOLD,
  REINVENTION_PHYSICAL_MULTIPLIER,
  REINVENTION_MENTAL_XP_MULTIPLIER,
  REINVENTION_MIN_AGE,
  REINVENTION_MIN_SEASONS,
} from "@/types/reinvention";
import type { MentalSkillRank } from "@/types/mentalSkills";
import { archiveSignatureSkill, getActiveSignatureSkill, narrativeReinventionArchive } from "./signatureSkillSystem";
import { applyReinventionReset as resetAllBadHabits } from "./badHabitSystem";

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Check whether a player is eligible to trigger the Reinvention Arc.
 *
 * Conditions (all must be true):
 * 1. Age 29+ OR 7+ seasons played
 * 2. Has at least 1 active Signature Skill
 * 3. No prior reinvention on record
 */
export function checkReinventionEligibility(
  player: Player,
  _season: number
): boolean {
  // Condition 1: age or seasons gate
  const age = player.age ?? 24;
  const seasons = player.seasonsPlayed ?? 0;

  if (age < REINVENTION_MIN_AGE && seasons < REINVENTION_MIN_SEASONS) {
    return false;
  }

  // Condition 2: must have an active signature skill
  const activeSig = getActiveSignatureSkill(player);
  if (!activeSig) {
    return false;
  }

  // Condition 3: only once per career
  if (player.reinventionEvent) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

/**
 * Trigger the Reinvention Arc for an eligible player.
 *
 * Side effects (all mutate `player` in place):
 * - Archives the active Signature Skill
 * - Resets all active bad habits to strength 0
 * - Applies reinvention season modifiers (−10% physical, +20% mental XP)
 * - Stores the ReinventionEvent on player.reinventionEvent
 *
 * @param player  - Player triggering reinvention
 * @param season  - Current season number
 * @param gameNumber - Game number within season (0 = off-season)
 * @returns The created ReinventionEvent
 * @throws Error if player is not eligible
 */
export function triggerReinvention(
  player: Player,
  season: number,
  gameNumber: number = 0
): ReinventionEvent {
  if (!checkReinventionEligibility(player, season)) {
    throw new Error(
      `Player ${player.id} (${player.name}) is not eligible for reinvention.`
    );
  }

  const activeSig = getActiveSignatureSkill(player)!;

  // 1. Archive active Signature Skill
  archiveSignatureSkill(player, activeSig.signatureId);

  // 2. Reset all bad habits
  const habitEvents = resetAllBadHabits(player, gameNumber);
  const resetHabits = habitEvents.map((e) => e.habitId);

  // 3. Reset opponent intel (via signatureSkill reputation — scoutLevel already tracks this;
  //    full reset happens in reputationSystem #31; here we list them from the sig's knownBy)
  const resetOpponents = [...(activeSig.reputation.knownBy ?? [])];

  // 4. Build event
  const event: ReinventionEvent = {
    reinventionId: `reinvention-${player.id}-s${season}`,
    playerId: player.id,
    triggeredAt: { season, gameNumber },
    archivedSignatureId: activeSig.signatureId,
    resetHabits,
    resetOpponents,
    outcome: "in_progress",
  };

  // 5. Store event + apply modifiers
  player.reinventionEvent = event;
  player.reinventionModifiers = {
    physicalMultiplier: REINVENTION_PHYSICAL_MULTIPLIER,
    mentalXpMultiplier: REINVENTION_MENTAL_XP_MULTIPLIER,
    expiresAfterSeason: season, // modifiers last through this season
  };

  return event;
}

// ---------------------------------------------------------------------------
// Modifier Application
// ---------------------------------------------------------------------------

/**
 * Returns the active reinvention modifiers for the current season.
 * Returns null if not in a reinvention season or modifiers have expired.
 */
export function getReinventionModifiers(
  player: Player,
  currentSeason: number
): ReinventionModifiers | null {
  const mods = player.reinventionModifiers;
  if (!mods) {
    return null;
  }

  if (currentSeason > mods.expiresAfterSeason) {
    return null; // Expired
  }

  return mods;
}

/**
 * Returns whether the player is in an active reinvention season.
 */
export function isInReinventionSeason(
  player: Player,
  currentSeason: number
): boolean {
  return getReinventionModifiers(player, currentSeason) !== null;
}

/**
 * Apply reinvention modifiers to a physical effectiveness value.
 * Returns the adjusted value (−10% if in reinvention season).
 */
export function applyPhysicalReinventionModifier(
  baseValue: number,
  player: Player,
  currentSeason: number
): number {
  const mods = getReinventionModifiers(player, currentSeason);
  if (!mods) {
    return baseValue;
  }
  return baseValue * mods.physicalMultiplier;
}

/**
 * Apply reinvention modifiers to mental XP gain.
 * Returns the adjusted XP value (+20% if in reinvention season).
 */
export function applyMentalXpReinventionModifier(
  baseXp: number,
  player: Player,
  currentSeason: number
): number {
  const mods = getReinventionModifiers(player, currentSeason);
  if (!mods) {
    return baseXp;
  }
  return Math.round(baseXp * mods.mentalXpMultiplier);
}

/**
 * Expire reinvention modifiers after the reinvention season ends.
 * Called at the start of the season following the reinvention season.
 */
export function expireReinventionModifiers(
  player: Player,
  currentSeason: number
): boolean {
  if (!player.reinventionModifiers) {
    return false;
  }

  if (currentSeason > player.reinventionModifiers.expiresAfterSeason) {
    player.reinventionModifiers = undefined;
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Outcome Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the outcome of a reinvention arc at season end.
 *
 * Success (avg > 0.220): arc marked complete with "success"
 * Failure (avg ≤ 0.220): arc marked "failure" — Veteran's Poise rank advances
 *
 * @param player      - Player to resolve
 * @param seasonStats - Season batting average
 * @param season      - Resolved season number
 */
export function resolveReinventionOutcome(
  player: Player,
  seasonStats: { avg: number },
  season: number
): "success" | "failure" | null {
  const event = player.reinventionEvent;
  if (!event || event.outcome !== "in_progress") {
    return null;
  }

  const isSuccess = seasonStats.avg > REINVENTION_SUCCESS_AVG_THRESHOLD;
  event.outcome = isSuccess ? "success" : "failure";
  event.resolvedAt = { season, finalAvg: seasonStats.avg };

  // Failure consolation: advance Veteran's Poise if player has it
  if (!isSuccess && player.mentalSkills) {
    const veteranPoise = player.mentalSkills.find((s) => s.skillId === "veteran_poise");
    if (veteranPoise && veteranPoise.rank < 5) {
      veteranPoise.rank = (veteranPoise.rank + 1) as MentalSkillRank;
      veteranPoise.xp = 0; // reset XP for new rank
    }
  }

  return event.outcome;
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

/**
 * Generate a narrative line for reinvention trigger.
 * Delegates to signatureSkillSystem — strings live in situationalPools.ts.
 */
export function narrativeReinventionTrigger(playerName: string): string {
  return narrativeReinventionArchive(playerName);
}

/**
 * Generate outcome narrative (win or lose the arc).
 */
export function narrativeReinventionOutcome(
  playerName: string,
  outcome: "success" | "failure"
): string {
  if (outcome === "success") {
    return `The new ${playerName} has arrived. Nobody saw that coming.`;
  }
  return `${playerName} struggled through the reinvention. But something quietly unlocked.`;
}
