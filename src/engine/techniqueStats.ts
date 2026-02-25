/**
 * Technique-Based Stat Calculations
 *
 * Calculates player stats from:
 * 1. Archetype base stats
 * 2. Technique bonuses
 * 3. Equipment bonuses
 *
 * This allows techniques to define player identity while maintaining
 * numeric stats for simulation compatibility.
 */

import type { Player, PlayerStats, BatterStats, PitcherStats } from "@/types/game";
import type { PlayerAbility, StatModifier } from "@/types/ability";
import { ARCHETYPE_INFO } from "@/types/ability";
import { getTechniqueById } from "@/data/techniques";
import { isBatter, isPitcher } from "@/types/game";

/**
 * Clamp a stat value between 0 and 100
 */
function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// ============================================
// ARCHETYPE BASE STATS
// ============================================

/**
 * Get base stats for a player's archetype
 * Returns default rookie stats if no archetype selected
 */
export function getArchetypeBaseStats(player: Player): PlayerStats {
  // If no class/archetype selected (level < 5), return current stats as base
  if (!player.class) {
    return player.stats;
  }

  // Get base stats from archetype definition
  const archetypeInfo = ARCHETYPE_INFO[player.class];
  if (!archetypeInfo) {
    console.warn(`Unknown archetype: ${player.class}`);
    return player.stats;
  }

  return archetypeInfo.baseStats;
}

// ============================================
// TECHNIQUE STAT BONUSES
// ============================================

/**
 * Calculate total stat bonuses from equipped techniques.
 *
 * Only passive techniques (isPassive: true) contribute permanent stat bonuses
 * to base stats. Active technique stat modifiers are applied temporarily
 * during at-bat activation via abilityEffects.ts.
 */
export function calculateTechniqueBonus(
  techniques: PlayerAbility[]
): Partial<PlayerStats> {
  const bonus: Record<string, number> = {};

  for (const technique of techniques) {
    const techniqueData = getTechniqueById(technique.abilityId);
    if (!techniqueData) {
      console.warn(`Unknown technique: ${technique.abilityId}`);
      continue;
    }

    // Only passive techniques provide permanent stat bonuses.
    // Active technique stat bonuses are applied at activation time.
    if (!techniqueData.isPassive) continue;

    // Apply rank multiplier (25% increase per rank)
    const rankMultiplier = 1 + (technique.rank - 1) * 0.25;

    // Sum up stat_modifier effects from passive techniques
    for (const effect of techniqueData.effects) {
      if (effect.type === "stat_modifier") {
        const statEffect = effect as StatModifier;

        // Batter stats
        if (statEffect.power) {
          bonus.power = (bonus.power || 0) + statEffect.power * rankMultiplier;
        }
        if (statEffect.contact) {
          bonus.contact =
            (bonus.contact || 0) + statEffect.contact * rankMultiplier;
        }
        if (statEffect.glove) {
          bonus.glove = (bonus.glove || 0) + statEffect.glove * rankMultiplier;
        }
        if (statEffect.speed) {
          bonus.speed = (bonus.speed || 0) + statEffect.speed * rankMultiplier;
        }

        // Pitcher stats
        if (statEffect.velocity) {
          bonus.velocity =
            (bonus.velocity || 0) + statEffect.velocity * rankMultiplier;
        }
        if (statEffect.control) {
          bonus.control =
            (bonus.control || 0) + statEffect.control * rankMultiplier;
        }
        if (statEffect.break) {
          bonus.break = (bonus.break || 0) + statEffect.break * rankMultiplier;
        }
      }
    }
  }

  return bonus;
}

// ============================================
// EQUIPMENT STAT BONUSES
// ============================================

/**
 * Calculate stat bonuses from equipment
 * (Extracted from existing itemStatsCalculator.ts logic)
 */
export function calculateEquipmentBonus(
  equipment: Player["equipment"]
): Partial<PlayerStats> {
  const bonus: Record<string, number> = {};

  // Sum stats from all equipped items
  for (const slot in equipment) {
    const item = equipment[slot as keyof typeof equipment];
    if (item && item.stats) {
      for (const stat in item.stats) {
        const value = item.stats[stat as keyof typeof item.stats];
        if (typeof value === "number") {
          bonus[stat] = (bonus[stat] || 0) + value;
        }
      }
    }
  }

  return bonus;
}

// ============================================
// DERIVED STAT CALCULATION
// ============================================

/**
 * Calculate final stats from archetype base + techniques + equipment
 *
 * This is the main function that bridges the technique system
 * with the existing numeric simulation.
 */
export function calculateDerivedStats(player: Player): PlayerStats {
  // 1. Get base stats from archetype (or current stats if no archetype)
  const baseStats = getArchetypeBaseStats(player);

  // 2. Add technique bonuses
  const techniqueBonus = calculateTechniqueBonus(player.abilities || []);

  // 3. Add equipment bonuses
  const equipmentBonus = calculateEquipmentBonus(player.equipment);

  // 4. Sum and clamp to 0-100 range
  if (isBatter(player)) {
    const base = baseStats as BatterStats;
    const techBonus = techniqueBonus as Partial<BatterStats>;
    const equipBonus = equipmentBonus as Partial<BatterStats>;
    return {
      power: clampStat((base.power || 0) + (techBonus.power || 0) + (equipBonus.power || 0)),
      contact: clampStat((base.contact || 0) + (techBonus.contact || 0) + (equipBonus.contact || 0)),
      glove: clampStat((base.glove || 0) + (techBonus.glove || 0) + (equipBonus.glove || 0)),
      speed: clampStat((base.speed || 0) + (techBonus.speed || 0) + (equipBonus.speed || 0)),
    } as BatterStats;
  } else if (isPitcher(player)) {
    const base = baseStats as PitcherStats;
    const techBonus = techniqueBonus as Partial<PitcherStats>;
    const equipBonus = equipmentBonus as Partial<PitcherStats>;
    return {
      velocity: clampStat((base.velocity || 0) + (techBonus.velocity || 0) + (equipBonus.velocity || 0)),
      control: clampStat((base.control || 0) + (techBonus.control || 0) + (equipBonus.control || 0)),
      break: clampStat((base.break || 0) + (techBonus.break || 0) + (equipBonus.break || 0)),
    } as PitcherStats;
  }

  // Fallback: return base stats
  return baseStats;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Update player.stats with derived stats
 * Mutates the player object
 */
export function updatePlayerDerivedStats(player: Player): void {
  player.stats = calculateDerivedStats(player);
}

/**
 * Get detailed stat breakdown for UI display
 */
export interface StatBreakdown {
  final: number;
  base: number;
  fromTechniques: number;
  fromEquipment: number;
}

export function getStatBreakdown(
  player: Player,
  statName: string
): StatBreakdown {
  const baseStats = getArchetypeBaseStats(player);
  const techniqueBonus = calculateTechniqueBonus(player.abilities || []);
  const equipmentBonus = calculateEquipmentBonus(player.equipment);

  const base = (baseStats as any)[statName] || 0;
  const technique = (techniqueBonus as any)[statName] || 0;
  const equipment = (equipmentBonus as any)[statName] || 0;

  return {
    final: clampStat(base + technique + equipment),
    base,
    fromTechniques: technique,
    fromEquipment: equipment,
  };
}
