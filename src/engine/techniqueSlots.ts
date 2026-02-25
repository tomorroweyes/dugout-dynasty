/**
 * Technique Slot Management
 *
 * Handles:
 * - Calculating technique slot usage
 * - Checking if techniques can be equipped
 * - Managing slot limits
 *
 * Players have limited slots (default: 5), forcing specialization.
 * Powerful techniques cost 2-3 slots.
 */

import type { Player, PlayerAbility } from "@/types/game";
import type { PlayerArchetype } from "@/types/ability";
import { getTechniqueById, getTechniquesForArchetype } from "@/data/techniques";

// ============================================
// SLOT CALCULATIONS
// ============================================

/**
 * Calculate how many technique slots a player is currently using
 */
export function calculateUsedSlots(techniques: PlayerAbility[]): number {
  return techniques.reduce((total, tech) => {
    const techniqueData = getTechniqueById(tech.abilityId);
    const slotCost = techniqueData?.slotCost || 1;
    return total + slotCost;
  }, 0);
}

/**
 * Get maximum technique slots for a player
 * Base: 5 slots + 1 per 10 levels
 */
export function getMaxTechniqueSlots(player: Player): number {
  if (player.maxTechniqueSlots !== undefined) {
    return player.maxTechniqueSlots;
  }

  // Default calculation: 5 base + level bonus
  const baseSlots = 5;
  const levelBonus = Math.floor(player.level / 10);
  return baseSlots + levelBonus;
}

/**
 * Get available (unused) technique slots
 */
export function getAvailableSlots(player: Player): number {
  const maxSlots = getMaxTechniqueSlots(player);
  const usedSlots = calculateUsedSlots(player.abilities || []);
  return Math.max(0, maxSlots - usedSlots);
}

// ============================================
// TECHNIQUE ELIGIBILITY
// ============================================

export interface CanEquipResult {
  canEquip: boolean;
  reason?: string;
}

/**
 * Check if a player can equip a technique
 */
export function canEquipTechnique(
  player: Player,
  techniqueId: string
): CanEquipResult {
  const technique = getTechniqueById(techniqueId);

  if (!technique) {
    return {
      canEquip: false,
      reason: "Technique not found",
    };
  }

  // Check level requirement
  if (player.level < technique.requiredLevel) {
    return {
      canEquip: false,
      reason: `Requires level ${technique.requiredLevel}`,
    };
  }

  // Check archetype restriction (with cross-archetype exception)
  const isDifferentArchetype = technique.requiredClass !== player.class;
  if (isDifferentArchetype && !technique.allowCrossArchetype) {
    return {
      canEquip: false,
      reason: `Only ${technique.requiredClass} can learn this`,
    };
  }

  // Check cross-archetype limit (max 2 techniques from other archetypes)
  if (isDifferentArchetype && technique.allowCrossArchetype) {
    const crossArchetypeCount = (player.abilities || []).filter((ability) => {
      const tech = getTechniqueById(ability.abilityId);
      return tech && tech.requiredClass !== player.class;
    }).length;

    if (crossArchetypeCount >= 2) {
      return {
        canEquip: false,
        reason: "Max 2 cross-archetype techniques (already at limit)",
      };
    }
  }

  // Check if already equipped
  const isAlreadyEquipped = player.abilities?.some(
    (t) => t.abilityId === techniqueId
  );
  if (isAlreadyEquipped) {
    return {
      canEquip: false,
      reason: "Already equipped",
    };
  }

  // Check mutually exclusive techniques (conflictsWith)
  if (technique.conflictsWith && technique.conflictsWith.length > 0) {
    for (const conflictId of technique.conflictsWith) {
      const hasConflict = player.abilities?.some((t) => t.abilityId === conflictId);
      if (hasConflict) {
        const conflictTech = getTechniqueById(conflictId);
        return {
          canEquip: false,
          reason: `Conflicts with ${conflictTech?.name || "another technique"}`,
        };
      }
    }
  }

  // Check prerequisite
  if (technique.prerequisiteAbilityId) {
    const hasPrereq = player.abilities?.some(
      (t) => t.abilityId === technique.prerequisiteAbilityId
    );
    if (!hasPrereq) {
      const prereqTech = getTechniqueById(technique.prerequisiteAbilityId);
      return {
        canEquip: false,
        reason: `Requires ${prereqTech?.name || "prerequisite technique"}`,
      };
    }
  }

  // Check slot availability
  const slotCost = technique.slotCost || 1;
  const availableSlots = getAvailableSlots(player);

  if (slotCost > availableSlots) {
    return {
      canEquip: false,
      reason: `Not enough slots (need ${slotCost}, have ${availableSlots})`,
    };
  }

  return { canEquip: true };
}

/**
 * Check if player can upgrade a technique
 */
export function canUpgradeTechnique(
  player: Player,
  techniqueId: string
): CanEquipResult {
  const technique = getTechniqueById(techniqueId);

  if (!technique) {
    return { canEquip: false, reason: "Technique not found" };
  }

  const playerTech = player.abilities?.find((t) => t.abilityId === techniqueId);

  if (!playerTech) {
    return { canEquip: false, reason: "Technique not equipped" };
  }

  if (playerTech.rank >= technique.maxRank) {
    return { canEquip: false, reason: "Already at max rank" };
  }

  // Check if player has skill points
  if (player.skillPoints <= 0) {
    return { canEquip: false, reason: "No skill points available" };
  }

  return { canEquip: true };
}

// ============================================
// AVAILABLE TECHNIQUES
// ============================================

/**
 * Get all techniques available for a player to learn
 * (meets level, archetype, and prerequisite requirements)
 */
export function getAvailableTechniques(
  player: Player,
  archetype: PlayerArchetype
): string[] {
  const allTechniques = getTechniquesForArchetype(archetype);

  return allTechniques
    .filter((tech: any) => {
      // Skip if already equipped
      const isEquipped = player.abilities?.some(
        (t) => t.abilityId === tech.id
      );
      if (isEquipped) return false;

      // Check level requirement
      if (player.level < tech.requiredLevel) return false;

      // Check prerequisite
      if (tech.prerequisiteAbilityId) {
        const hasPrereq = player.abilities?.some(
          (t) => t.abilityId === tech.prerequisiteAbilityId
        );
        if (!hasPrereq) return false;
      }

      return true;
    })
    .map((tech) => tech.id);
}

// ============================================
// TECHNIQUE MANAGEMENT
// ============================================

/**
 * Equip a technique (add to player's abilities)
 * Returns updated player or undefined if cannot equip
 */
export function equipTechnique(
  player: Player,
  techniqueId: string
): Player | undefined {
  const check = canEquipTechnique(player, techniqueId);

  if (!check.canEquip) {
    console.warn(`Cannot equip ${techniqueId}: ${check.reason}`);
    return undefined;
  }

  const technique = getTechniqueById(techniqueId);
  if (!technique) return undefined;

  // Add technique to player's abilities
  const newAbility: PlayerAbility = {
    abilityId: techniqueId,
    rank: 1,
    timesUsed: 0,
  };

  return {
    ...player,
    abilities: [...(player.abilities || []), newAbility],
    skillPoints: player.skillPoints - 1, // Cost 1 skill point to learn
  };
}

/**
 * Unequip a technique (remove from player's abilities)
 */
export function unequipTechnique(
  player: Player,
  techniqueId: string
): Player {
  return {
    ...player,
    abilities: (player.abilities || []).filter(
      (t) => t.abilityId !== techniqueId
    ),
    // Note: Does not refund skill points
  };
}

/**
 * Upgrade a technique (increase rank)
 */
export function upgradeTechnique(
  player: Player,
  techniqueId: string
): Player | undefined {
  const check = canUpgradeTechnique(player, techniqueId);

  if (!check.canEquip) {
    console.warn(`Cannot upgrade ${techniqueId}: ${check.reason}`);
    return undefined;
  }

  // Increase technique rank
  const updatedAbilities = (player.abilities || []).map((t) =>
    t.abilityId === techniqueId ? { ...t, rank: t.rank + 1 } : t
  );

  return {
    ...player,
    abilities: updatedAbilities,
    skillPoints: player.skillPoints - 1, // Cost 1 skill point to upgrade
  };
}
