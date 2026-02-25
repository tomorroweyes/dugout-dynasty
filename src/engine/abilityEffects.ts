import type { BatterStats, PitcherStats } from "@/types/game";
import type {
  ActiveAbilityContext,
  AbilityEffect,
  StatModifier,
  OutcomeModifier,
  GuaranteedOutcome,
  Technique,
} from "@/types/ability";
import type { ActiveSynergies } from "./synergySystem";
// Inline the result type to avoid circular dependency with atBatSimulator
type AtBatResultType =
  | "strikeout" | "walk" | "single" | "double" | "triple"
  | "homerun" | "groundout" | "flyout" | "lineout" | "popout";

/**
 * Ability Effects Calculator
 *
 * Handles applying ability effects to:
 * - Player stats (power, contact, velocity, etc.)
 * - Outcome probabilities (HR chance, strikeout chance, etc.)
 * - Game mechanics (fatigue negation, guaranteed outcomes)
 */

// ============================================
// STAT MODIFICATION
// ============================================

/**
 * Apply ability stat modifiers to batter stats
 */
export function applyBatterAbilityEffects(
  baseStats: BatterStats,
  activeAbility?: ActiveAbilityContext
): BatterStats {
  if (!activeAbility) return baseStats;

  let modifiedStats = { ...baseStats };

  for (const effect of activeAbility.effects) {
    if (effect.type === "stat_modifier") {
      const statEffect = effect as StatModifier;

      // Apply batter stat bonuses
      if (statEffect.power !== undefined) {
        modifiedStats.power += statEffect.power;
      }
      if (statEffect.contact !== undefined) {
        modifiedStats.contact += statEffect.contact;
      }
      if (statEffect.glove !== undefined) {
        modifiedStats.glove += statEffect.glove;
      }
      if (statEffect.speed !== undefined) {
        modifiedStats.speed += statEffect.speed;
      }
    }
  }

  // Clamp stats to 0-100 to match the base stat system ceiling
  modifiedStats.power = Math.max(0, Math.min(100, modifiedStats.power));
  modifiedStats.contact = Math.max(0, Math.min(100, modifiedStats.contact));
  modifiedStats.glove = Math.max(0, Math.min(100, modifiedStats.glove));
  modifiedStats.speed = Math.max(0, Math.min(100, modifiedStats.speed));

  return modifiedStats;
}

/**
 * Apply ability stat modifiers to pitcher stats
 */
export function applyPitcherAbilityEffects(
  baseStats: PitcherStats,
  activeAbility?: ActiveAbilityContext
): PitcherStats {
  if (!activeAbility) return baseStats;

  let modifiedStats = { ...baseStats };

  for (const effect of activeAbility.effects) {
    if (effect.type === "stat_modifier") {
      const statEffect = effect as StatModifier;

      // Apply pitcher stat bonuses
      if (statEffect.velocity !== undefined) {
        modifiedStats.velocity += statEffect.velocity;
      }
      if (statEffect.control !== undefined) {
        modifiedStats.control += statEffect.control;
      }
      if (statEffect.break !== undefined) {
        modifiedStats.break += statEffect.break;
      }
    }
  }

  // Clamp stats to 0-100 to match the base stat system ceiling
  modifiedStats.velocity = Math.max(0, Math.min(100, modifiedStats.velocity));
  modifiedStats.control = Math.max(0, Math.min(100, modifiedStats.control));
  modifiedStats.break = Math.max(0, Math.min(100, modifiedStats.break));

  return modifiedStats;
}

// ============================================
// OUTCOME MODIFICATION
// ============================================

/**
 * Apply ability outcome modifiers to probability calculations
 */
export function applyOutcomeModifiers(
  baseValue: number,
  modifierType:
    | "homerun"
    | "strikeout"
    | "walk"
    | "hit"
    | "netScore"
    | "defense",
  activeAbility?: ActiveAbilityContext
): number {
  if (!activeAbility) return baseValue;

  let modifiedValue = baseValue;

  for (const effect of activeAbility.effects) {
    if (effect.type === "outcome_modifier") {
      const outcomeEffect = effect as OutcomeModifier;

      switch (modifierType) {
        case "homerun":
          if (outcomeEffect.homerunBonus !== undefined) {
            modifiedValue += outcomeEffect.homerunBonus;
          }
          break;
        case "strikeout":
          if (outcomeEffect.strikeoutBonus !== undefined) {
            modifiedValue += outcomeEffect.strikeoutBonus; // Positive = more Ks, negative = fewer Ks
          }
          break;
        case "walk":
          if (outcomeEffect.walkBonus !== undefined) {
            modifiedValue += outcomeEffect.walkBonus;
          }
          break;
        case "hit":
        case "netScore":
          if (outcomeEffect.hitBonus !== undefined) {
            modifiedValue += outcomeEffect.hitBonus;
          }
          break;
      }
    }

    // Apply defensive boost to defense calculations
    if (
      modifierType === "defense" &&
      effect.type === "defensive_boost"
    ) {
      modifiedValue += effect.gloveBonus;
    }
  }

  return modifiedValue;
}

// ============================================
// GUARANTEED OUTCOMES
// ============================================

/**
 * Check if ability guarantees a specific outcome
 * Returns the outcome type and success chance, or null if no guarantee
 */
export function getGuaranteedOutcome(
  activeAbility?: ActiveAbilityContext
): GuaranteedOutcome | null {
  if (!activeAbility) return null;

  for (const effect of activeAbility.effects) {
    if (effect.type === "guaranteed_outcome") {
      return effect as GuaranteedOutcome;
    }
  }

  return null;
}

/**
 * Check if guaranteed outcome succeeds (based on success chance)
 */
export function rollGuaranteedOutcome(
  guaranteedOutcome: GuaranteedOutcome,
  random: () => number = Math.random
): boolean {
  const roll = random() * 100;
  return roll <= guaranteedOutcome.successChance;
}

/**
 * Resolve a guaranteed outcome that may have multiple possible results.
 *
 * For multi-outcome abilities (e.g., Moonshot: 55% HR / 45% K),
 * rolls against the outcomes distribution.
 *
 * For legacy single-outcome abilities, falls back to the existing
 * outcome + successChance logic.
 *
 * @param guaranteed - The guaranteed outcome effect
 * @param roll - A random value 0-100
 * @param isBatterAbility - Whether this is a batter ability (affects failure fallback)
 */
export function resolveMultiOutcome(
  guaranteed: GuaranteedOutcome,
  roll: number,
  isBatterAbility: boolean = true
): AtBatResultType {
  // Multi-outcome path: use the outcomes distribution
  if (guaranteed.outcomes && guaranteed.outcomes.length > 0) {
    let cumulative = 0;
    for (const entry of guaranteed.outcomes) {
      cumulative += entry.chance;
      if (roll <= cumulative) {
        if (entry.result === "out") return "groundout";
        if (entry.result === "bunt_attempt") return "single";
        return entry.result as AtBatResultType;
      }
    }
    // Safety fallback (shouldn't reach here if chances sum to 100)
    return "groundout";
  }

  // Legacy single-outcome path
  if (roll <= guaranteed.successChance) {
    switch (guaranteed.outcome) {
      case "homerun": return "homerun";
      case "single":
      case "bunt_attempt": return "single";
      case "walk": return "walk";
      case "strikeout": return "strikeout";
    }
  }

  // Failure fallback: batter abilities → strikeout, pitcher abilities → walk
  return isBatterAbility ? "strikeout" : "walk";
}

/**
 * Get the effective "power" of a guaranteed outcome for clash resolution.
 * Uses successChance for legacy abilities, or the highest single chance
 * from the outcomes array for multi-outcome abilities.
 */
export function getGuaranteedOutcomePower(
  guaranteed: GuaranteedOutcome
): number {
  if (guaranteed.outcomes && guaranteed.outcomes.length > 0) {
    return Math.max(...guaranteed.outcomes.map((o) => o.chance));
  }
  return guaranteed.successChance;
}

// ============================================
// SPECIAL FLAGS
// ============================================

/**
 * Check if ability negates fatigue (Time Warp ability, Iron Arm)
 */
export function negatesFatigue(activeAbility?: ActiveAbilityContext): boolean {
  if (!activeAbility) return false;

  for (const effect of activeAbility.effects) {
    if (effect.type === "stat_modifier") {
      const statEffect = effect as StatModifier;
      if (statEffect.negateFatigue === true) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Apply Repertoire passive penalty if same ability used consecutively
 * Returns modified pitcher stats with -10 Break penalty if applicable
 *
 * @param baseStats - Base pitcher stats
 * @param hasRepertoire - Whether pitcher has Repertoire passive
 * @param currentAbilityId - Ability being used this at-bat
 * @param previousAbilityId - Ability used in previous at-bat
 */
export function applyRepertoirePenalty(
  baseStats: import("@/types/game").PitcherStats,
  hasRepertoire: boolean,
  currentAbilityId?: string,
  previousAbilityId?: string
): import("@/types/game").PitcherStats {
  if (!hasRepertoire || !currentAbilityId || !previousAbilityId) {
    return baseStats;
  }

  // If same ability used twice in a row, apply -10 Break penalty
  if (currentAbilityId === previousAbilityId) {
    return {
      ...baseStats,
      break: Math.max(0, baseStats.break - 10),
    };
  }

  return baseStats;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get all stat modifiers from an ability
 */
export function getStatModifiers(
  activeAbility?: ActiveAbilityContext
): StatModifier[] {
  if (!activeAbility) return [];

  return activeAbility.effects.filter(
    (e): e is StatModifier => e.type === "stat_modifier"
  );
}

/**
 * Get all outcome modifiers from an ability
 */
export function getOutcomeModifiers(
  activeAbility?: ActiveAbilityContext
): OutcomeModifier[] {
  if (!activeAbility) return [];

  return activeAbility.effects.filter(
    (e): e is OutcomeModifier => e.type === "outcome_modifier"
  );
}

/**
 * Check if ability has any effect
 */
export function hasAnyEffect(activeAbility?: ActiveAbilityContext): boolean {
  return activeAbility !== undefined && activeAbility.effects.length > 0;
}

// ============================================
// SYNERGY-ENHANCED TECHNIQUES
// ============================================

/**
 * Get bonus effects for a technique when its required synergy is active.
 * Returns the bonus effects array (empty if synergy not met).
 *
 * @param technique - The technique to check
 * @param synergies - Active synergies for the team
 * @param isSynergyActiveFn - Function to check if a synergy is active (injected to avoid circular deps)
 */
export function getSynergyEnhancementEffects(
  technique: Technique,
  synergies: ActiveSynergies | undefined,
  isSynergyActiveFn: (synergies: ActiveSynergies, id: string, tier?: "bronze" | "silver" | "gold") => boolean
): AbilityEffect[] {
  if (!technique.synergyEnhancement || !synergies) return [];

  const { requiredSynergy, requiredTier } = technique.synergyEnhancement;

  if (isSynergyActiveFn(synergies, requiredSynergy, requiredTier)) {
    return technique.synergyEnhancement.bonusEffects;
  }

  return [];
}

/**
 * Get human-readable description of ability effects
 */
export function describeEffects(effects: AbilityEffect[]): string[] {
  const descriptions: string[] = [];

  for (const effect of effects) {
    if (effect.type === "stat_modifier") {
      const statEffect = effect as StatModifier;
      if (statEffect.power) {
        descriptions.push(
          `${statEffect.power > 0 ? "+" : ""}${statEffect.power} Power`
        );
      }
      if (statEffect.contact) {
        descriptions.push(
          `${statEffect.contact > 0 ? "+" : ""}${statEffect.contact} Contact`
        );
      }
      if (statEffect.glove) {
        descriptions.push(
          `${statEffect.glove > 0 ? "+" : ""}${statEffect.glove} Glove`
        );
      }
      if (statEffect.velocity) {
        descriptions.push(
          `${statEffect.velocity > 0 ? "+" : ""}${statEffect.velocity} Velocity`
        );
      }
      if (statEffect.control) {
        descriptions.push(
          `${statEffect.control > 0 ? "+" : ""}${statEffect.control} Control`
        );
      }
      if (statEffect.break) {
        descriptions.push(
          `${statEffect.break > 0 ? "+" : ""}${statEffect.break} Break`
        );
      }
      if (statEffect.negateFatigue) {
        descriptions.push("Removes fatigue");
      }
    } else if (effect.type === "outcome_modifier") {
      const outcomeEffect = effect as OutcomeModifier;
      if (outcomeEffect.homerunBonus) {
        descriptions.push(`${outcomeEffect.homerunBonus}% HR chance`);
      }
      if (outcomeEffect.strikeoutBonus) {
        if (outcomeEffect.strikeoutBonus > 0) {
          descriptions.push(`+${outcomeEffect.strikeoutBonus}% strikeout chance`);
        } else {
          descriptions.push(`${outcomeEffect.strikeoutBonus}% strikeout chance`);
        }
      }
      if (outcomeEffect.walkBonus) {
        descriptions.push(`${outcomeEffect.walkBonus}% walk chance`);
      }
      if (outcomeEffect.hitBonus) {
        descriptions.push(
          `${outcomeEffect.hitBonus > 0 ? "+" : ""}${outcomeEffect.hitBonus}% hit quality`
        );
      }
    } else if (effect.type === "guaranteed_outcome") {
      const guaranteedEffect = effect as GuaranteedOutcome;
      descriptions.push(
        `${guaranteedEffect.successChance}% chance: ${guaranteedEffect.outcome}`
      );
    } else if (effect.type === "defensive_boost") {
      descriptions.push(`+${effect.gloveBonus} team defense`);
    }
  }

  return descriptions;
}
