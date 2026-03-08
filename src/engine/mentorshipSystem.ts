/**
 * Mentorship System
 *
 * Handles mentor-apprentice pairing, style transfer, XP modifiers,
 * legacy lineage tracking, and linea bonus application.
 *
 * See GitHub issues #36, #37.
 */

import type { Player } from "@/types/game";
import type {
  MentorshipPair,
  StyleTransfer,
  LineageNode,
} from "@/types/mentorship";
import {
  MENTORSHIP_MIN_AGE_GAP,
  MENTOR_XP_MULTIPLIER,
  APPRENTICE_XP_MULTIPLIER,
  STYLE_TRANSFER_POSITIVE_CHANCE,
  STYLE_TRANSFER_COUNT,
  SEEDED_HABIT_STRENGTH,
  LEGACY_BONUS_PER_GENERATION,
  LEGACY_BONUS_CAP,
} from "@/types/mentorship";
import type { MentalSkillType } from "@/types/mentalSkills";
import type { BadHabitType } from "@/types/badHabits";
import { getActiveSignatureSkill } from "./signatureSkillSystem";
import { getActiveHabits } from "./badHabitSystem";
import { randomChoice } from "./textPools";
import {
  MENTOR_STYLE_TRANSFER_POSITIVE_TEXTS,
  MENTOR_STYLE_TRANSFER_NEGATIVE_TEXTS,
  LINEAGE_ONE_GEN_TEXTS,
  LINEAGE_THREE_GEN_TEXTS,
} from "./narrative/situationalPools";

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Check whether a mentor–apprentice pairing is valid.
 *
 * Conditions:
 * 1. Mentor is 5+ years older than apprentice
 * 2. Mentor has at least 1 active Signature Skill
 * 3. Neither player is currently in a mentorship
 */
export function checkMentorEligibility(
  mentor: Player,
  apprentice: Player
): boolean {
  const mentorAge = mentor.age ?? 24;
  const apprenticeAge = apprentice.age ?? 24;

  // Condition 1: age gap
  if (mentorAge - apprenticeAge < MENTORSHIP_MIN_AGE_GAP) {
    return false;
  }

  // Condition 2: mentor has active signature skill
  const sig = getActiveSignatureSkill(mentor);
  if (!sig) {
    return false;
  }

  // Condition 3: neither in existing pair
  if (mentor.activeMentorship || apprentice.activeMentorship) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Pair Creation
// ---------------------------------------------------------------------------

/**
 * Create a mentorship pair for the coming season.
 *
 * Side effects:
 * - Runs STYLE_TRANSFER_COUNT style transfer rolls
 * - Stores pairing on both players
 * - Adds lineage entry to apprentice
 *
 * @param mentor     - The mentor player
 * @param apprentice - The apprentice player
 * @param season     - Season number when the pair forms
 * @param rng        - Optional RNG function (defaults to Math.random)
 * @returns The created MentorshipPair
 * @throws Error if not eligible
 */
export function createMentorship(
  mentor: Player,
  apprentice: Player,
  season: number,
  rng: () => number = Math.random
): MentorshipPair {
  if (!checkMentorEligibility(mentor, apprentice)) {
    throw new Error(
      `Mentorship not eligible: ${mentor.name} → ${apprentice.name}`
    );
  }

  const styleTransfers = resolveStyleTransfer(mentor, apprentice, rng);
  const pairId = `pair-${mentor.id}-${apprentice.id}-s${season}`;

  const pair: MentorshipPair = {
    pairId,
    mentorId: mentor.id,
    apprenticeId: apprentice.id,
    season,
    styleTransfers,
    isActive: true,
    renewedSeasons: [],
  };

  // Store pairing on both players
  mentor.activeMentorship = pair;
  apprentice.activeMentorship = pair;

  if (!mentor.mentorshipHistory) mentor.mentorshipHistory = [];
  if (!apprentice.mentorshipHistory) apprentice.mentorshipHistory = [];
  mentor.mentorshipHistory.push(pair);
  apprentice.mentorshipHistory.push(pair);

  // Add lineage to apprentice
  addLineageNode(apprentice, mentor);

  // Seed negative style transfer habits on apprentice
  applyNegativeStyleTransfers(styleTransfers, mentor, apprentice);

  return pair;
}

// ---------------------------------------------------------------------------
// Style Transfer
// ---------------------------------------------------------------------------

/**
 * Resolve STYLE_TRANSFER_COUNT style transfer rolls (70% positive / 30% negative).
 *
 * Positive: apprentice gains discovery acceleration for mentor's primary skill category
 * Negative: mentor's top bad habit seeds on apprentice at strength SEEDED_HABIT_STRENGTH
 */
export function resolveStyleTransfer(
  mentor: Player,
  apprentice: Player,
  rng: () => number = Math.random
): StyleTransfer[] {
  const transfers: StyleTransfer[] = [];
  const sig = getActiveSignatureSkill(mentor);
  const mentorSkillId = sig?.skillId ?? "ice_veins";

  const topHabit = getActiveHabits(mentor).sort((a, b) => b.strength - a.strength)[0];

  for (let i = 0; i < STYLE_TRANSFER_COUNT; i++) {
    const isPositive = rng() < STYLE_TRANSFER_POSITIVE_CHANCE;

    if (isPositive) {
      const template = randomChoice(MENTOR_STYLE_TRANSFER_POSITIVE_TEXTS);
      const desc = template
        .replace(/{mentorName}/g, mentor.name)
        .replace(/{apprenticeName}/g, apprentice.name)
        .replace(/{skillName}/g, mentorSkillId);

      transfers.push({
        type: "positive",
        description: desc,
        mechanicEffect: `discovery_bonus:${mentorSkillId}`,
        magnitude: 0.05, // +5% discovery chance for mentor's skill category
      });
    } else {
      const habitType = topHabit?.habitType ?? "pull_happy";
      const template = randomChoice(MENTOR_STYLE_TRANSFER_NEGATIVE_TEXTS);
      const desc = template
        .replace(/{mentorName}/g, mentor.name)
        .replace(/{apprenticeName}/g, apprentice.name);

      transfers.push({
        type: "negative",
        description: desc,
        mechanicEffect: `seed_habit:${habitType}`,
        magnitude: SEEDED_HABIT_STRENGTH,
      });
    }
  }

  return transfers;
}

/**
 * Apply any negative style transfers as seeded bad habits on the apprentice.
 */
function applyNegativeStyleTransfers(
  transfers: StyleTransfer[],
  _mentor: Player,
  apprentice: Player
): void {
  const negatives = transfers.filter((t) => t.type === "negative");

  for (const transfer of negatives) {
    // Parse habit type from mechanicEffect
    const [, habitType] = transfer.mechanicEffect.split(":");
    if (!habitType) continue;

    if (!apprentice.badHabits) {
      apprentice.badHabits = [];
    }

    // Only seed if apprentice doesn't already have this habit
    const alreadyHas = apprentice.badHabits.some((h) => h.habitType === habitType);
    if (alreadyHas) continue;

    apprentice.badHabits.push({
      habitId: `habit-seeded-${apprentice.id}-${habitType}`,
      habitType: habitType as BadHabitType,
      formationType: "style_transfer",
      strength: SEEDED_HABIT_STRENGTH,
      isActive: false, // Seeded at 5; becomes active at > 50
      consecutiveUses: 0,
      consecutiveNonUses: 0,
      formedAtGame: 0,
      opponentKnowledge: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// XP Modifiers
// ---------------------------------------------------------------------------

/**
 * Context needed to determine mentorship XP modifier.
 */
export interface MentorshipGameContext {
  /** Whether the mentor is in the active roster for this game */
  mentorInActiveRoster: boolean;
  /** Whether the apprentice is in the active roster for this game */
  apprenticeInActiveRoster: boolean;
}

/**
 * Get the XP modifier for a player given their mentorship state.
 * Returns the multiplier to apply to XP earned (1.0 = no change).
 *
 * @param player  - The player earning XP
 * @param context - Roster context for this game
 */
export function applyMentorshipXPModifiers(
  player: Player,
  context: MentorshipGameContext
): number {
  const pair = player.activeMentorship;
  if (!pair || !pair.isActive) {
    return 1.0; // No mentorship
  }

  // Both must be in the active roster for modifiers to apply
  if (!context.mentorInActiveRoster || !context.apprenticeInActiveRoster) {
    return 1.0;
  }

  const isMentor = player.id === pair.mentorId;
  if (isMentor) {
    return MENTOR_XP_MULTIPLIER; // −20%
  }

  return APPRENTICE_XP_MULTIPLIER; // +40%
}

// ---------------------------------------------------------------------------
// Season Management
// ---------------------------------------------------------------------------

/**
 * End a mentorship for the off-season (pair becomes inactive).
 * Can be renewed next season with `renewMentorship`.
 */
export function endMentorship(
  mentor: Player,
  apprentice: Player
): void {
  if (mentor.activeMentorship) {
    mentor.activeMentorship.isActive = false;
    mentor.activeMentorship = undefined;
  }

  if (apprentice.activeMentorship) {
    apprentice.activeMentorship.isActive = false;
    apprentice.activeMentorship = undefined;
  }
}

/**
 * Renew a mentorship for another season.
 * Re-validates eligibility (signature still required).
 */
export function renewMentorship(
  mentor: Player,
  apprentice: Player,
  season: number,
  rng: () => number = Math.random
): MentorshipPair {
  // Mark any old pair as inactive
  if (mentor.activeMentorship) {
    mentor.activeMentorship.isActive = false;
    mentor.activeMentorship = undefined;
  }
  if (apprentice.activeMentorship) {
    apprentice.activeMentorship.isActive = false;
    apprentice.activeMentorship = undefined;
  }

  const pair = createMentorship(mentor, apprentice, season, rng);

  // Record the renewal season on the pair
  const prevPair = mentor.mentorshipHistory?.find(
    (p) => p.mentorId === mentor.id && p.apprenticeId === apprentice.id && p.season < season
  );
  if (prevPair) {
    pair.renewedSeasons = [...prevPair.renewedSeasons, season];
  }

  return pair;
}

// ---------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------

/**
 * Add a lineage node (the mentor) to the apprentice's lineage chain.
 * Existing chain is shifted up one generation (max 3 generations tracked).
 */
export function addLineageNode(apprentice: Player, mentor: Player): void {
  const sig = getActiveSignatureSkill(mentor);

  const newNode: LineageNode = {
    playerId: mentor.id,
    playerName: mentor.name,
    signatureSkillId: sig?.signatureId,
    signatureSkillName: sig?.skillName,
    generation: 1,
  };

  if (!apprentice.lineage) {
    apprentice.lineage = [];
  }

  // Shift existing nodes up one generation
  for (const node of apprentice.lineage) {
    node.generation += 1;
  }

  // Cap at 3 generations
  apprentice.lineage = [newNode, ...apprentice.lineage.filter((n) => n.generation <= 3)];
}

/**
 * Build the full lineage chain for a player by walking the player index.
 *
 * @param player     - The player whose lineage to build
 * @param allPlayers - Index of all players in the simulation
 * @returns Array of LineageNode, generation 1 = direct mentor, 2 = their mentor, 3 = great-mentor
 */
export function buildLineageChain(
  player: Player,
  allPlayers: Map<string, Player>
): LineageNode[] {
  const chain: LineageNode[] = [];
  let current: Player = player;
  let gen = 1;

  while (gen <= 3) {
    // Find mentor in history
    const mentorId = current.mentorshipHistory?.find(
      (p) => p.apprenticeId === current.id
    )?.mentorId;

    if (!mentorId) break;

    const mentor = allPlayers.get(mentorId);
    if (!mentor) break;

    const sig = getActiveSignatureSkill(mentor);
    chain.push({
      playerId: mentor.id,
      playerName: mentor.name,
      signatureSkillId: sig?.signatureId,
      signatureSkillName: sig?.skillName,
      generation: gen,
    });

    current = mentor;
    gen++;
  }

  return chain;
}

/**
 * Calculate the legacy discovery bonus for a player in a specific skill.
 *
 * Rules:
 * - Direct mentor had Signature in same skill: +5%
 * - 2-generation chain with same skill: +8%
 * - 3-generation chain: +12% (capped at +20% total)
 *
 * @param player   - Apprentice
 * @param skillId  - Skill being checked
 * @returns Bonus multiplier addend (e.g. 0.05 = +5%)
 */
export function applyLegacyBonus(player: Player, skillId: MentalSkillType): number {
  const lineage = player.lineage ?? [];
  let bonus = 0;

  for (const node of lineage) {
    if (node.signatureSkillId && skillId && node.signatureSkillName?.includes(skillId)) {
      bonus += LEGACY_BONUS_PER_GENERATION * node.generation;
    }
  }

  return Math.min(bonus, LEGACY_BONUS_CAP);
}

/**
 * Get the positive style transfer discovery bonus for a skill category.
 * Returns the combined magnitude of all positive transfers for the given skill.
 */
export function getStyleTransferDiscoveryBonus(
  pair: MentorshipPair,
  skillId: MentalSkillType
): number {
  return pair.styleTransfers
    .filter(
      (t) => t.type === "positive" && t.mechanicEffect === `discovery_bonus:${skillId}`
    )
    .reduce((sum, t) => sum + t.magnitude, 0);
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

/**
 * Generate a lineage narrative for a player and skill.
 * Uses 3-generation text if chain is long enough.
 */
export function generateLegacyNarrative(
  player: Player,
  skillId: MentalSkillType,
  allPlayers?: Map<string, Player>
): string {
  const chain = allPlayers ? buildLineageChain(player, allPlayers) : (player.lineage ?? []);

  if (chain.length === 0) {
    return "";
  }

  const directMentor = chain.find((n) => n.generation === 1);
  const skillName = skillId.replace(/_/g, " ");

  if (chain.length >= 3) {
    const template = randomChoice(LINEAGE_THREE_GEN_TEXTS);
    return template
      .replace(/{playerName}/g, player.name)
      .replace(/{skillName}/g, skillName);
  }

  const template = randomChoice(LINEAGE_ONE_GEN_TEXTS);
  return template
    .replace(/{playerName}/g, player.name)
    .replace(/{mentorName}/g, directMentor?.playerName ?? "their mentor")
    .replace(/{skillName}/g, skillName);
}
