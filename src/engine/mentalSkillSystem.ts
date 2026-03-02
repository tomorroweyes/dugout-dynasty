/**
 * Mental Skill Discovery & Progression Engine — Phase 1
 *
 * This module handles:
 *   - Discovering new mental skills (trait + condition checks)
 *   - Granting XP for triggered skills (high-leverage vs. normal)
 *   - Rank-up logic
 *   - Confidence decay for un-triggered skills
 *   - Dormancy (isActive = false when confidence < threshold)
 *   - Reactivation bonus (2x XP for recovering lapsed skills)
 */

import type { Player } from "@/types/game";
import type {
  MentalSkill,
  MentalSkillType,
  MentalSkillRank,
} from "@/types/mentalSkills";
import {
  MENTAL_SKILL_RANK_XP,
  MENTAL_SKILL_XP_GAIN,
  MENTAL_SKILL_DISCOVERY_CONDITIONS,
  DEFAULT_DECAY_RATE,
  CONFIDENCE_ACTIVE_THRESHOLD,
  REACTIVATION_XP_MULTIPLIER,
  TRAIT_TO_MENTAL_SKILL,
  MENTAL_SKILL_RANK_BONUS,
} from "@/types/mentalSkills";

// ─── Discovery Context ────────────────────────────────────────────────────────

/**
 * Contextual data passed to the discovery check.
 * Assembled from match state at the moment of a potential discovery trigger.
 */
export interface MentalSkillDiscoveryContext {
  playerAge: number;
  gameNumber: number;          // Monotonic game counter for lastTriggeredGame
  isHighLeverage: boolean;
  inning: number;
  scoreDiff: number;           // abs value; close = ≤ 2
  seasonWalkCount?: number;    // Batter walk count this season (for pitch_recognition)
  hadRedemptionPayoff?: boolean; // Clutch Composure: redemption arc paid off this AB
  completeSeasonsPlayed: number;
  beatSamePitcherCount?: number; // Game Reading: consecutive successes vs. same pitcher
}

// ─── Post-Game Update Context ─────────────────────────────────────────────────

/**
 * Summary of a player's mental skill activity in one game.
 * Passed to updateMentalSkillsPostGame after each match.
 */
export interface PostGameMentalStats {
  playerAge: number;
  gameNumber: number;
  /** Mental skill types that were triggered in high-leverage contexts this game */
  highLeverageTriggered: MentalSkillType[];
  /** Mental skill types triggered in normal (non-high-leverage) contexts */
  normalTriggered: MentalSkillType[];
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function nextRank(rank: MentalSkillRank): MentalSkillRank {
  return Math.min(5, rank + 1) as MentalSkillRank;
}

function isMaxRank(rank: MentalSkillRank): boolean {
  return rank === 5;
}

function xpNeeded(rank: MentalSkillRank): number {
  return MENTAL_SKILL_RANK_XP[rank];
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Attempt to discover a specific mental skill for a player.
 * Returns a new MentalSkill object at rank 0 if conditions are met, or null.
 *
 * Callers should check that the player doesn't already have this skill before
 * calling. If `player.mentalSkills` already contains skillId, do nothing.
 */
export function discoverMentalSkill(
  player: Player,
  skillId: MentalSkillType,
  context: MentalSkillDiscoveryContext
): MentalSkill | null {
  // Already discovered
  if (player.mentalSkills?.some((s) => s.skillId === skillId)) return null;

  const condition = MENTAL_SKILL_DISCOVERY_CONDITIONS.find(
    (c) => c.skillId === skillId
  );
  if (!condition) return null;

  // Must have the required trait
  if (!player.traits.includes(condition.traitRequired as Player["traits"][number])) {
    return null;
  }

  // Check leverage requirement
  if (condition.leverageRequired && !context.isHighLeverage) return null;

  // Check age requirement (veteran_poise: age 31+)
  if (condition.minAge != null && context.playerAge < condition.minAge) {
    // Allow early discovery with 5+ complete seasons as an alternative
    if (context.completeSeasonsPlayed < 5) return null;
  }

  // Condition-specific additional checks
  switch (skillId) {
    case "pitch_recognition":
      // Requires 15+ walks in a season OR 3 complete seasons of exposure
      if (
        (context.seasonWalkCount ?? 0) < 15 &&
        context.completeSeasonsPlayed < 3
      ) {
        return null;
      }
      break;
    case "clutch_composure":
      // Requires a redemption arc payoff
      if (!context.hadRedemptionPayoff) return null;
      break;
    case "game_reading":
      // Requires 3 complete seasons OR 3 consecutive successes vs same pitcher
      if (
        context.completeSeasonsPlayed < 3 &&
        (context.beatSamePitcherCount ?? 0) < 3
      ) {
        return null;
      }
      break;
    default:
      break;
  }

  // All conditions passed — create the skill at rank 0
  const skill: MentalSkill = {
    skillId,
    rank: 0,
    xp: 0,
    xpToNextRank: xpNeeded(0),
    confidence: 50, // Start at half confidence
    lastTriggeredGame: context.gameNumber,
    isActive: true,
    decayRate: DEFAULT_DECAY_RATE,
    wasLapsed: false,
    discoveredAt: context.gameNumber,
  };

  return skill;
}

// ─── XP Gain & Rank-Up ────────────────────────────────────────────────────────

/**
 * Add XP to a mental skill. Handles:
 *   - Reactivation bonus (2x when wasLapsed = true)
 *   - Rank-up if XP threshold crossed
 *   - Confidence boost on trigger
 *
 * Returns updated MentalSkill (immutable — does not mutate input).
 */
export function grantMentalSkillXp(
  skill: MentalSkill,
  isHighLeverage: boolean,
  gameNumber: number
): MentalSkill {
  if (isMaxRank(skill.rank)) {
    // Still boost confidence at max rank
    return {
      ...skill,
      confidence: Math.min(100, skill.confidence + 10),
      lastTriggeredGame: gameNumber,
      isActive: true,
    };
  }

  const baseXp = isHighLeverage
    ? MENTAL_SKILL_XP_GAIN.HIGH_LEVERAGE
    : MENTAL_SKILL_XP_GAIN.NORMAL;

  // 2x XP if recovering from lapse
  const xpGained = skill.wasLapsed ? baseXp * REACTIVATION_XP_MULTIPLIER : baseXp;

  let newXp = skill.xp + xpGained;
  let newRank = skill.rank;
  let wasLapsed = false; // Clear lapsed flag once XP is flowing again

  // Handle single rank-up (XP can overflow)
  while (!isMaxRank(newRank) && newXp >= xpNeeded(newRank)) {
    newXp -= xpNeeded(newRank);
    newRank = nextRank(newRank);
  }

  const confidenceBoost = isHighLeverage ? 15 : 8;

  return {
    ...skill,
    rank: newRank,
    xp: newXp,
    xpToNextRank: xpNeeded(newRank),
    confidence: Math.min(100, skill.confidence + confidenceBoost),
    lastTriggeredGame: gameNumber,
    isActive: true,
    wasLapsed,
  };
}

// ─── Decay ────────────────────────────────────────────────────────────────────

/**
 * Apply confidence decay for a skill that was NOT triggered this game.
 * Marks skill as dormant if confidence drops below threshold.
 *
 * Returns updated MentalSkill (immutable).
 */
export function applyMentalSkillDecay(skill: MentalSkill): MentalSkill {
  const newConfidence = Math.max(0, skill.confidence - skill.decayRate);
  const isActive = newConfidence >= CONFIDENCE_ACTIVE_THRESHOLD;
  const wasLapsed = !isActive && skill.confidence > 0 && newConfidence === 0
    ? true
    : skill.wasLapsed;

  return {
    ...skill,
    confidence: newConfidence,
    isActive,
    wasLapsed: skill.wasLapsed || wasLapsed,
  };
}

// ─── Post-Game Update ─────────────────────────────────────────────────────────

/**
 * Process all mental skills for a player after a game ends.
 *   1. Grant XP to triggered skills
 *   2. Decay confidence on untriggered skills
 *
 * Returns updated Player with modified mentalSkills array.
 * Safe to call when player.mentalSkills is undefined (returns player unchanged).
 */
export function updateMentalSkillsPostGame(
  player: Player,
  stats: PostGameMentalStats
): Player {
  if (!player.mentalSkills || player.mentalSkills.length === 0) return player;

  const allTriggered = new Set<MentalSkillType>([
    ...stats.highLeverageTriggered,
    ...stats.normalTriggered,
  ]);

  const updatedSkills = player.mentalSkills.map((skill) => {
    if (allTriggered.has(skill.skillId)) {
      const isHighLeverage = stats.highLeverageTriggered.includes(skill.skillId);
      return grantMentalSkillXp(skill, isHighLeverage, stats.gameNumber);
    }
    return applyMentalSkillDecay(skill);
  });

  return { ...player, mentalSkills: updatedSkills };
}

// ─── Skill Trigger Check ──────────────────────────────────────────────────────

/**
 * Determine if a given mental skill should be considered "triggered"
 * during a specific at-bat context.
 *
 * Used by the match engine to build the PostGameMentalStats.
 * Returns true if the contextual conditions align with the skill's domain.
 */
export function checkSkillTrigger(
  skillId: MentalSkillType,
  context: {
    isHighLeverage: boolean;
    inning: number;
    scoreDiff: number;
    batterApproach?: string;
    outcome?: string;
  }
): boolean {
  switch (skillId) {
    case "ice_veins":
      // Triggered in high-leverage, close-game situations
      return context.isHighLeverage && context.scoreDiff <= 2;
    case "pitch_recognition":
      // Triggered when batter uses disciplined approach (walk or contact)
      return (
        context.batterApproach === "contact" ||
        context.outcome === "walk"
      );
    case "clutch_composure":
      // Triggered in high-leverage at-bats regardless of outcome
      return context.isHighLeverage;
    case "veteran_poise":
      // Triggered in late innings (7+) — experience managing pressure
      return context.inning >= 7;
    case "game_reading":
      // Triggered on non-strikeout outcomes — pattern recognition succeeds
      return (
        context.outcome !== "strikeout" &&
        context.outcome !== undefined
      );
    default:
      return false;
  }
}

// ─── Effective Bonus ──────────────────────────────────────────────────────────

/**
 * Get the effective stat bonus for a mental skill, factoring in confidence.
 * An inactive skill contributes nothing.
 *
 * confidence modifier: bonus * (confidence / 100)
 */
export function getMentalSkillBonus(skill: MentalSkill): number {
  if (!skill.isActive) return 0;
  const rawBonus = MENTAL_SKILL_RANK_BONUS[skill.rank];
  return Math.round(rawBonus * (skill.confidence / 100));
}

// ─── Player Mental Trait Helpers ─────────────────────────────────────────────

/**
 * Get the mental skill types a player is eligible to discover,
 * based on their traits alone (no context check).
 */
export function getEligibleMentalSkills(player: Player): MentalSkillType[] {
  const alreadyHas = new Set(
    player.mentalSkills?.map((s) => s.skillId) ?? []
  );
  return player.traits
    .map((trait) => TRAIT_TO_MENTAL_SKILL[trait])
    .filter((skillId): skillId is MentalSkillType => !!skillId && !alreadyHas.has(skillId));
}
