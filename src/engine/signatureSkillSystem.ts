/**
 * Signature Skill System
 *
 * Handles generation, effectiveness, and reputation spread of Signature Skills.
 * Signature Skills unlock at Rank 4→5 via breakthrough (no active bad habit).
 *
 * See GitHub issue #33.
 */

import type { Player } from "@/types/game";
import type { BreakthroughEvent, SignatureSkill, SignatureSkillReputation } from "@/types/breakthroughs";
import type { MentalSkillType } from "@/types/mentalSkills";
import { randomChoice } from "./textPools";
import {
  SIGNATURE_SKILL_USE_TEXTS,
  SIGNATURE_COUNTER_TEXTS,
  SIGNATURE_REVEAL_TEXTS,
  REINVENTION_ARCHIVE_TEXTS,
} from "./narrative/situationalPools";

// ---------------------------------------------------------------------------
// Variant Name Catalogue
// ---------------------------------------------------------------------------

/** Skill category → variant name pool */
const SIGNATURE_VARIANT_NAMES: Record<string, string[]> = {
  power:   ["Hammer", "Cannon", "Bomb", "Blast", "Spike"],
  speed:   ["Flash", "Blur", "Ghost", "Dart", "Arrow"],
  contact: ["Scalpel", "Brush", "Needle", "Chip"],
  pitching: ["Blade", "Cutter", "Bender", "Vapor"],
  defense: ["Wall", "Vacuum", "Stone", "Iron"],
};

/** Maps mental skill IDs to a variant category for naming */
const SKILL_TO_CATEGORY: Record<MentalSkillType, keyof typeof SIGNATURE_VARIANT_NAMES> = {
  ice_veins:         "contact",   // composure → precision
  pitch_recognition: "contact",   // eye → contact
  clutch_composure:  "power",     // clutch → power moment
  veteran_poise:     "defense",   // poise → defense reads
  game_reading:      "defense",   // game intelligence
};

// ---------------------------------------------------------------------------
// Reputation thresholds — cumulative high-leverage uses
// ---------------------------------------------------------------------------

export const SIGNATURE_REPUTATION_THRESHOLDS = {
  tier1: 10,  // 10 HL uses → Tier 1 spread (some teams know)
  tier2: 25,  // 25 HL uses → Tier 2 spread (most teams know)
  tier3: 50,  // 50 HL uses → Tier 3 spread (every team, full counter)
} as const;

/** Effect reduction per scout tier (0=none, 1=5%, 2=25%, 3=50%) */
export const SIGNATURE_COUNTER_REDUCTION: Record<0 | 1 | 2 | 3, number> = {
  0: 0.00,
  1: 0.05,
  2: 0.25,
  3: 0.50,
};

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Generate a Signature Skill from a breakthrough event.
 * Called by breakthroughSystem when a Rank 4→5 advance occurs.
 *
 * @param player   - Player who earned the skill
 * @param breakthrough - The breakthrough event that triggered this
 * @returns A fresh SignatureSkill at scoutLevel 0
 */
export function generateSignatureSkill(
  player: Player,
  breakthrough: BreakthroughEvent
): SignatureSkill {
  const skillId = breakthrough.skillId as MentalSkillType;
  const category = SKILL_TO_CATEGORY[skillId] ?? "contact";
  const variants = SIGNATURE_VARIANT_NAMES[category] ?? SIGNATURE_VARIANT_NAMES["contact"];
  const variantName = randomChoice(variants);
  const signatureName = `${player.name}'s ${variantName}`;

  const reputation: SignatureSkillReputation = {
    knownBy: [],
    counterStrategies: [],
    scoutLevel: 0,
    highLeverageUses: 0,
  };

  return {
    signatureId:  breakthrough.signatureSkillId ?? `sig-${player.id}-${skillId}-${Date.now()}`,
    skillId,
    playerId:     player.id,
    skillName:    signatureName,
    effectBonus:  0.10, // +10% above Rank 5 effectiveness
    unlockedAt:   breakthrough,
    isActive:     true,
    isArchived:   false,
    reputation,
  };
}

/**
 * Apply signature skill effectiveness, accounting for opponent scout level.
 *
 * @param baseEffect   - The base effectiveness multiplier (e.g. 1.0 = 100%)
 * @param signature    - The active signature skill
 * @param scoutLevel   - Opponent's current scout level (0–3)
 * @returns Adjusted effectiveness after counter-reduction
 */
export function applySignatureEffect(
  baseEffect: number,
  signature: SignatureSkill,
  scoutLevel: 0 | 1 | 2 | 3
): number {
  if (!signature.isActive || signature.isArchived) {
    return baseEffect;
  }

  const bonus = signature.effectBonus;
  const counterReduction = SIGNATURE_COUNTER_REDUCTION[scoutLevel];

  // Bonus is reduced by counter level:  full bonus at 0, 50% of bonus at Tier 3
  const effectiveBonus = bonus * (1 - counterReduction);

  return baseEffect + effectiveBonus;
}

/**
 * Record a high-leverage use of the signature skill and update reputation tier.
 *
 * @param signature - The signature skill (mutated in place)
 * @param opponentName - Optional: name of team that witnessed the use
 */
export function recordHighLeverageUse(
  signature: SignatureSkill,
  opponentName?: string
): void {
  if (!signature.isActive || signature.isArchived) {
    return;
  }

  signature.reputation.highLeverageUses = (signature.reputation.highLeverageUses ?? 0) + 1;
  const uses = signature.reputation.highLeverageUses;

  // Track which team saw it
  if (opponentName && !signature.reputation.knownBy.includes(opponentName)) {
    signature.reputation.knownBy.push(opponentName);
  }

  // Update scout tier based on cumulative uses
  if (uses >= SIGNATURE_REPUTATION_THRESHOLDS.tier3 && signature.reputation.scoutLevel < 3) {
    signature.reputation.scoutLevel = 3;
    signature.reputation.counterStrategies.push("Full scouting profile active");
  } else if (uses >= SIGNATURE_REPUTATION_THRESHOLDS.tier2 && signature.reputation.scoutLevel < 2) {
    signature.reputation.scoutLevel = 2;
    signature.reputation.counterStrategies.push("Pattern identified — adjust pitch sequencing");
  } else if (uses >= SIGNATURE_REPUTATION_THRESHOLDS.tier1 && signature.reputation.scoutLevel < 1) {
    signature.reputation.scoutLevel = 1;
  }
}

/**
 * Archive the player's active signature skill (called on reinvention).
 * The skill becomes visible as a legacy item but no longer fires.
 *
 * @param player       - Player undergoing reinvention
 * @param signatureId  - ID of the signature to archive
 */
export function archiveSignatureSkill(player: Player, signatureId: string): boolean {
  const sig = player.signatureSkills?.get(signatureId);
  if (!sig) {
    return false;
  }

  sig.isActive = false;
  sig.isArchived = true;
  return true;
}

/**
 * Get the player's current active (non-archived) signature skill, or null.
 */
export function getActiveSignatureSkill(player: Player): SignatureSkill | null {
  if (!player.signatureSkills) {
    return null;
  }

  for (const sig of player.signatureSkills.values()) {
    if (sig.isActive && !sig.isArchived) {
      return sig;
    }
  }

  return null;
}

/**
 * Get all archived (legacy) signature skills for a player.
 */
export function getArchivedSignatureSkills(player: Player): SignatureSkill[] {
  if (!player.signatureSkills) {
    return [];
  }

  return Array.from(player.signatureSkills.values()).filter((s) => s.isArchived);
}

/**
 * Store a generated signature skill on the player.
 * Enforces max 1 active per player (others must be archived first).
 *
 * @throws Error if another active signature exists
 */
export function attachSignatureToPlayer(
  player: Player,
  signature: SignatureSkill
): void {
  if (!player.signatureSkills) {
    player.signatureSkills = new Map();
  }

  // Enforce: only 1 active signature at a time
  const existing = getActiveSignatureSkill(player);
  if (existing) {
    throw new Error(
      `Player ${player.id} already has an active signature skill: ${existing.skillName}. Archive it before adding a new one.`
    );
  }

  player.signatureSkills.set(signature.signatureId, signature);
}

// ---------------------------------------------------------------------------
// Narrative helpers
// ---------------------------------------------------------------------------

/** Signature fires — narrative line for play-by-play */
export function narrativeSignatureUse(playerName: string, signatureName: string): string {
  const template = randomChoice(SIGNATURE_SKILL_USE_TEXTS);
  return template
    .replace(/{playerName}/g, playerName)
    .replace(/{signatureName}/g, signatureName);
}

/** Opponents counter the signature */
export function narrativeSignatureCounter(playerName: string, signatureName: string): string {
  const template = randomChoice(SIGNATURE_COUNTER_TEXTS);
  return template
    .replace(/{playerName}/g, playerName)
    .replace(/{signatureName}/g, signatureName);
}

/** Opponents have just discovered the signature (reputation milestone) */
export function narrativeSignatureReveal(playerName: string, signatureName: string): string {
  const template = randomChoice(SIGNATURE_REVEAL_TEXTS);
  return template
    .replace(/{playerName}/g, playerName)
    .replace(/{signatureName}/g, signatureName);
}

/** Player undergoes reinvention — signature archived, slate wiped */
export function narrativeReinventionArchive(playerName: string): string {
  const template = randomChoice(REINVENTION_ARCHIVE_TEXTS);
  return template.replace(/{playerName}/g, playerName);
}
