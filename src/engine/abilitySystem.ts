import type { Player } from "@/types/game";
import type {
  Ability,
  PlayerAbility,
  AbilityEffect,
  ABILITY_CONSTANTS,
} from "@/types/ability";
import { calculateMaxSpirit } from "@/types/ability";
import { getAbilityById } from "@/data/abilities";
import { ALL_TECHNIQUES } from "@/data/techniques";
import { getPrerequisites } from "@/data/skillTrees";

/**
 * Ability System Engine
 *
 * Handles:
 * - Unlocking new abilities
 * - Upgrading existing abilities
 * - Checking activation requirements
 * - Spirit cost deduction
 * - Ability effect scaling by rank
 */

// ============================================
// UNLOCK LOGIC
// ============================================

/**
 * Check if player meets requirements to unlock an ability
 */
export function canUnlockAbility(
  player: Player,
  abilityId: string
): {
  canUnlock: boolean;
  reason?: string;
} {
  const ability = getAbilityById(abilityId);
  if (!ability) {
    return { canUnlock: false, reason: "Ability not found" };
  }

  // Check class requirement
  if (!player.class) {
    return { canUnlock: false, reason: "No class selected" };
  }

  if (player.class !== ability.requiredClass) {
    return {
      canUnlock: false,
      reason: `Requires ${ability.requiredClass} class`,
    };
  }

  // Check level requirement
  if (player.level < ability.requiredLevel) {
    return {
      canUnlock: false,
      reason: `Requires level ${ability.requiredLevel}`,
    };
  }

  // Check if already unlocked
  if (player.abilities.some((a) => a.abilityId === abilityId)) {
    return { canUnlock: false, reason: "Already unlocked" };
  }

  // Check skill points
  if (player.skillPoints < 1) {
    return { canUnlock: false, reason: "No skill points available" };
  }

  // Check prerequisites
  if (ability.prerequisiteAbilityId) {
    const hasPrereq = player.abilities.some(
      (a) => a.abilityId === ability.prerequisiteAbilityId
    );
    if (!hasPrereq) {
      const prereqAbility = getAbilityById(ability.prerequisiteAbilityId);
      return {
        canUnlock: false,
        reason: `Requires ${prereqAbility?.name || "prerequisite ability"}`,
      };
    }
  }

  return { canUnlock: true };
}

/**
 * Unlock an ability for a player (immutable)
 */
export function unlockAbility(player: Player, abilityId: string): Player {
  const { canUnlock } = canUnlockAbility(player, abilityId);
  if (!canUnlock) return player;

  const newAbility: PlayerAbility = {
    abilityId,
    rank: 1,
    timesUsed: 0,
  };

  return {
    ...player,
    abilities: [...player.abilities, newAbility],
    skillPoints: player.skillPoints - 1,
  };
}

// ============================================
// UPGRADE LOGIC
// ============================================

/**
 * Check if player can upgrade an ability
 */
export function canUpgradeAbility(
  player: Player,
  abilityId: string
): {
  canUpgrade: boolean;
  reason?: string;
} {
  const ability = getAbilityById(abilityId);
  const playerAbility = player.abilities.find((a) => a.abilityId === abilityId);

  if (!ability) {
    return { canUpgrade: false, reason: "Ability not found" };
  }

  if (!playerAbility) {
    return { canUpgrade: false, reason: "Ability not unlocked" };
  }

  if (playerAbility.rank >= ability.maxRank) {
    return { canUpgrade: false, reason: "Already at max rank" };
  }

  if (player.skillPoints < 1) {
    return { canUpgrade: false, reason: "No skill points available" };
  }

  return { canUpgrade: true };
}

/**
 * Upgrade an ability to next rank (immutable)
 */
export function upgradeAbility(player: Player, abilityId: string): Player {
  const { canUpgrade } = canUpgradeAbility(player, abilityId);
  if (!canUpgrade) return player;

  return {
    ...player,
    abilities: player.abilities.map((a) =>
      a.abilityId === abilityId ? { ...a, rank: a.rank + 1 } : a
    ),
    skillPoints: player.skillPoints - 1,
  };
}

// ============================================
// ACTIVATION LOGIC
// ============================================

/**
 * Check if player has the Economizer passive (20% spirit cost reduction)
 */
function hasEconomizerPassive(player: Player): boolean {
  return player.abilities.some((a) => a.abilityId === "economizer");
}

/**
 * Calculate effective spirit cost for an ability (accounts for Economizer passive)
 */
export function getEffectiveSpiritCost(
  player: Player,
  abilityId: string
): number {
  const ability = getAbilityById(abilityId);
  if (!ability) return 0;

  let cost = ability.spiritCost;

  // Apply Economizer passive (20% reduction)
  if (hasEconomizerPassive(player)) {
    cost = Math.ceil(cost * 0.8);
  }

  return cost;
}

/**
 * Check if player has enough spirit to activate ability
 */
export function canActivateAbility(
  player: Player,
  abilityId: string
): {
  canActivate: boolean;
  reason?: string;
} {
  const ability = getAbilityById(abilityId);
  if (!ability) {
    return { canActivate: false, reason: "Ability not found" };
  }

  // Check if unlocked
  const playerAbility = player.abilities.find((a) => a.abilityId === abilityId);
  if (!playerAbility) {
    return { canActivate: false, reason: "Ability not unlocked" };
  }

  // Check spirit (with Economizer reduction if applicable)
  const effectiveCost = getEffectiveSpiritCost(player, abilityId);
  if (player.spirit.current < effectiveCost) {
    return {
      canActivate: false,
      reason: `Not enough spirit (need ${effectiveCost})`,
    };
  }

  return { canActivate: true };
}

/**
 * Deduct spirit cost after ability use (immutable)
 */
export function deductSpiritCost(player: Player, abilityId: string): Player {
  const ability = getAbilityById(abilityId);
  if (!ability) return player;

  // Use effective cost (accounts for Economizer passive)
  const effectiveCost = getEffectiveSpiritCost(player, abilityId);

  return {
    ...player,
    spirit: {
      ...player.spirit,
      current: Math.max(0, player.spirit.current - effectiveCost),
    },
    abilities: player.abilities.map((a) =>
      a.abilityId === abilityId ? { ...a, timesUsed: a.timesUsed + 1 } : a
    ),
  };
}

/**
 * Regenerate spirit to max (call between games)
 */
export function regenerateSpirit(player: Player): Player {
  const maxSpirit = calculateMaxSpirit(player.level);
  return {
    ...player,
    spirit: {
      current: maxSpirit,
      max: maxSpirit,
    },
  };
}

// ============================================
// ABILITY EFFECT SCALING
// ============================================

/**
 * Calculate ability effect values based on rank
 * Higher ranks = stronger effects (25% increase per rank)
 */
export function getScaledAbilityEffects(
  abilityId: string,
  rank: number
): Ability | undefined {
  const baseAbility = getAbilityById(abilityId);
  if (!baseAbility) return undefined;

  const RANK_MULTIPLIER = 1.25; // Each rank is 25% stronger
  const multiplier = Math.pow(RANK_MULTIPLIER, rank - 1);

  // Scale numeric values in effects
  const scaledEffects: AbilityEffect[] = baseAbility.effects.map((effect) => {
    const scaled = { ...effect };

    // Scale all numeric properties except boolean flags
    const mutable = scaled as Record<string, unknown>;
    Object.keys(mutable).forEach((key) => {
      const value = mutable[key];
      if (
        typeof value === "number" &&
        key !== "duration" &&
        key !== "successChance"
      ) {
        mutable[key] = Math.floor(value * multiplier);
      }
    });

    return scaled;
  });

  return {
    ...baseAbility,
    currentRank: rank,
    effects: scaledEffects,
    spiritCost: Math.floor(baseAbility.spiritCost * Math.pow(1.1, rank - 1)), // Spirit cost increases slightly per rank
  };
}

/**
 * Get player's version of an ability (with their rank)
 */
export function getPlayerAbility(
  player: Player,
  abilityId: string
): Ability | undefined {
  const playerAbility = player.abilities.find((a) => a.abilityId === abilityId);
  if (!playerAbility) return undefined;

  return getScaledAbilityEffects(abilityId, playerAbility.rank);
}

// ============================================
// RESPEC LOGIC
// ============================================

/**
 * Calculate respec cost for a player
 */
export function calculateRespecCost(player: Player): number {
  const BASE_COST = 1000;
  return BASE_COST * player.level;
}

/**
 * Respec a player's abilities (returns all skill points, clears abilities)
 */
export function respecAbilities(player: Player): Player {
  // Calculate total skill points earned (1 per level, starting at level 1)
  const totalSkillPoints = player.level;

  return {
    ...player,
    abilities: [], // Clear all abilities
    skillPoints: totalSkillPoints, // Return all skill points
    // Note: Class is preserved (doesn't reset)
  };
}

/**
 * Check if player can afford respec
 */
export function canAffordRespec(
  player: Player,
  teamCash: number
): {
  canAfford: boolean;
  cost: number;
  reason?: string;
} {
  const cost = calculateRespecCost(player);

  if (player.abilities.length === 0) {
    return { canAfford: false, cost, reason: "No abilities to reset" };
  }

  if (teamCash < cost) {
    return { canAfford: false, cost, reason: "Not enough gold" };
  }

  return { canAfford: true, cost };
}

// ============================================
// SKILL POINT MANAGEMENT
// ============================================

/**
 * Award skill point on level up
 */
export function awardSkillPoint(player: Player): Player {
  // Award skill points from level 1 onwards (1 per level)
  return {
    ...player,
    skillPoints: player.skillPoints + 1,
  };
}

/**
 * Calculate total skill points a player should have based on level
 * (used for validation and migration)
 */
export function calculateTotalSkillPoints(level: number): number {
  return level; // 1 point per level, starting at level 1
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get all abilities the player has unlocked
 */
export function getPlayerAbilities(player: Player): Ability[] {
  return player.abilities
    .map((pa) => getPlayerAbility(player, pa.abilityId))
    .filter((a): a is Ability => a !== undefined);
}

/**
 * Check if player has unlocked any abilities
 */
export function hasAnyAbilities(player: Player): boolean {
  return player.abilities.length > 0;
}

/**
 * Get abilities that are ready to unlock (requirements met)
 */
export function getUnlockableAbilities(player: Player): Ability[] {
  if (!player.class) return [];

  return ALL_TECHNIQUES
    .filter((ability) => ability.requiredClass === player.class)
    .filter((ability) => {
      const { canUnlock } = canUnlockAbility(player, ability.id);
      return canUnlock;
    });
}
