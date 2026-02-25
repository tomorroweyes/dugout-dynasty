/**
 * Synergy System - Core Logic
 *
 * Computed once at match start from lineup traits.
 * Returns stat bonuses and outcome modifiers to inject into the at-bat pipeline.
 */

import type { Player, PlayerTrait } from "@/types/game";
import type { AbilityEffect, StatModifier, OutcomeModifier } from "@/types/ability";
import {
  SINGLE_TRAIT_SYNERGIES,
  COMBO_SYNERGIES,
  ALL_TRAITS,
  type SynergyTier,
  type SingleTraitSynergyDef,
  type ComboSynergyDef,
} from "./synergyConfig";

// ============================================
// ACTIVE SYNERGY RESULT
// ============================================

export interface ActiveSingleSynergy {
  synergy: SingleTraitSynergyDef;
  tier: SynergyTier;
  traitCount: number;
  effects: AbilityEffect[];
}

export interface ActiveComboSynergy {
  synergy: ComboSynergyDef;
  effects: AbilityEffect[];
}

export interface ActiveSynergies {
  single: ActiveSingleSynergy[];
  combo: ActiveComboSynergy[];
  traitCounts: Record<PlayerTrait, number>;
  /** Pre-merged batter stat bonuses (additive) */
  batterStatBonuses: { power: number; contact: number; glove: number; speed: number };
  /** Pre-merged pitcher stat bonuses (additive) */
  pitcherStatBonuses: { velocity: number; control: number; break: number };
  /** Pre-merged outcome modifiers */
  outcomeModifiers: { strikeoutBonus: number; walkBonus: number; homerunBonus: number; hitBonus: number };
}

// ============================================
// TRAIT COUNTING
// ============================================

/**
 * Count traits across all players in a lineup.
 */
export function countTraits(players: Player[]): Record<PlayerTrait, number> {
  const counts = {} as Record<PlayerTrait, number>;
  for (const trait of ALL_TRAITS) {
    counts[trait] = 0;
  }
  for (const player of players) {
    if (!player.traits) continue;
    for (const trait of player.traits) {
      counts[trait]++;
    }
  }
  return counts;
}

// ============================================
// SYNERGY RESOLUTION
// ============================================

/**
 * Resolve which single-trait synergies are active and at what tier.
 */
function resolveSingleTraitSynergies(
  traitCounts: Record<PlayerTrait, number>
): ActiveSingleSynergy[] {
  const active: ActiveSingleSynergy[] = [];

  for (const synergy of SINGLE_TRAIT_SYNERGIES) {
    const count = traitCounts[synergy.trait];
    if (count >= synergy.tiers.gold.threshold) {
      active.push({
        synergy,
        tier: "gold",
        traitCount: count,
        effects: synergy.tiers.gold.effects,
      });
    } else if (count >= synergy.tiers.silver.threshold) {
      active.push({
        synergy,
        tier: "silver",
        traitCount: count,
        effects: synergy.tiers.silver.effects,
      });
    } else if (count >= synergy.tiers.bronze.threshold) {
      active.push({
        synergy,
        tier: "bronze",
        traitCount: count,
        effects: synergy.tiers.bronze.effects,
      });
    }
  }

  return active;
}

/**
 * Resolve which combo synergies are active.
 */
function resolveComboSynergies(
  traitCounts: Record<PlayerTrait, number>
): ActiveComboSynergy[] {
  const active: ActiveComboSynergy[] = [];

  for (const synergy of COMBO_SYNERGIES) {
    const met = synergy.requirements.every(
      (req) => traitCounts[req.trait] >= req.count
    );
    if (met) {
      active.push({ synergy, effects: synergy.effects });
    }
  }

  return active;
}

/**
 * Pre-merge all synergy effects into additive stat bonuses and outcome modifiers.
 * This is called once at match start for efficiency.
 */
function mergeEffects(allEffects: AbilityEffect[]): {
  batterStatBonuses: { power: number; contact: number; glove: number; speed: number };
  pitcherStatBonuses: { velocity: number; control: number; break: number };
  outcomeModifiers: { strikeoutBonus: number; walkBonus: number; homerunBonus: number; hitBonus: number };
} {
  const batter = { power: 0, contact: 0, glove: 0, speed: 0 };
  const pitcher = { velocity: 0, control: 0, break: 0 };
  const outcome = { strikeoutBonus: 0, walkBonus: 0, homerunBonus: 0, hitBonus: 0 };

  for (const effect of allEffects) {
    if (effect.type === "stat_modifier") {
      const sm = effect as StatModifier;
      if (sm.power) batter.power += sm.power;
      if (sm.contact) batter.contact += sm.contact;
      if (sm.glove) batter.glove += sm.glove;
      if (sm.speed) batter.speed += sm.speed;
      if (sm.velocity) pitcher.velocity += sm.velocity;
      if (sm.control) pitcher.control += sm.control;
      if (sm.break) pitcher.break += sm.break;
    } else if (effect.type === "outcome_modifier") {
      const om = effect as OutcomeModifier;
      if (om.strikeoutBonus) outcome.strikeoutBonus += om.strikeoutBonus;
      if (om.walkBonus) outcome.walkBonus += om.walkBonus;
      if (om.homerunBonus) outcome.homerunBonus += om.homerunBonus;
      if (om.hitBonus) outcome.hitBonus += om.hitBonus;
    }
  }

  return { batterStatBonuses: batter, pitcherStatBonuses: pitcher, outcomeModifiers: outcome };
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Calculate all active synergies for a lineup.
 * Called once at match start. Returns derived state (never stored in saves).
 */
export function calculateSynergies(lineup: Player[]): ActiveSynergies {
  const traitCounts = countTraits(lineup);
  const single = resolveSingleTraitSynergies(traitCounts);
  const combo = resolveComboSynergies(traitCounts);

  // Collect all effects
  const allEffects: AbilityEffect[] = [];
  for (const s of single) allEffects.push(...s.effects);
  for (const c of combo) allEffects.push(...c.effects);

  const { batterStatBonuses, pitcherStatBonuses, outcomeModifiers } = mergeEffects(allEffects);

  return {
    single,
    combo,
    traitCounts,
    batterStatBonuses,
    pitcherStatBonuses,
    outcomeModifiers,
  };
}

/**
 * Create an empty synergies object (for when no synergies are active).
 */
export function emptySynergies(): ActiveSynergies {
  const traitCounts = {} as Record<PlayerTrait, number>;
  for (const trait of ALL_TRAITS) traitCounts[trait] = 0;
  return {
    single: [],
    combo: [],
    traitCounts,
    batterStatBonuses: { power: 0, contact: 0, glove: 0, speed: 0 },
    pitcherStatBonuses: { velocity: 0, control: 0, break: 0 },
    outcomeModifiers: { strikeoutBonus: 0, walkBonus: 0, homerunBonus: 0, hitBonus: 0 },
  };
}

// ============================================
// SYNERGY QUERIES (for UI and technique enhancement)
// ============================================

/**
 * Check if a specific synergy is active at or above a given tier.
 */
export function isSynergyActive(
  synergies: ActiveSynergies,
  synergyId: string,
  minTier?: SynergyTier
): boolean {
  // Check single-trait synergies
  for (const s of synergies.single) {
    if (s.synergy.id === synergyId) {
      if (!minTier) return true;
      return tierAtLeast(s.tier, minTier);
    }
  }
  // Check combo synergies (no tiers, always "active")
  for (const c of synergies.combo) {
    if (c.synergy.id === synergyId) return true;
  }
  return false;
}

const TIER_ORDER: SynergyTier[] = ["bronze", "silver", "gold"];

function tierAtLeast(actual: SynergyTier, required: SynergyTier): boolean {
  return TIER_ORDER.indexOf(actual) >= TIER_ORDER.indexOf(required);
}

/**
 * Get synergy completion hints for drafting.
 * Returns synergies that would be completed/upgraded by adding a player with given traits.
 */
export function getSynergyHints(
  currentTraitCounts: Record<PlayerTrait, number>,
  candidateTraits: PlayerTrait[]
): { synergyName: string; tier: SynergyTier | "active"; emoji: string }[] {
  const hints: { synergyName: string; tier: SynergyTier | "active"; emoji: string }[] = [];

  // Simulate adding candidate traits
  const simCounts = { ...currentTraitCounts };
  for (const t of candidateTraits) {
    simCounts[t] = (simCounts[t] || 0) + 1;
  }

  // Check single-trait synergies
  for (const synergy of SINGLE_TRAIT_SYNERGIES) {
    const before = currentTraitCounts[synergy.trait] || 0;
    const after = simCounts[synergy.trait] || 0;

    // Check if we cross a threshold
    for (const tier of ["bronze", "silver", "gold"] as SynergyTier[]) {
      const threshold = synergy.tiers[tier].threshold;
      if (before < threshold && after >= threshold) {
        hints.push({ synergyName: synergy.name, tier, emoji: synergy.emoji });
      }
    }
  }

  // Check combo synergies
  for (const synergy of COMBO_SYNERGIES) {
    const wasMet = synergy.requirements.every(
      (req) => (currentTraitCounts[req.trait] || 0) >= req.count
    );
    const nowMet = synergy.requirements.every(
      (req) => (simCounts[req.trait] || 0) >= req.count
    );
    if (!wasMet && nowMet) {
      hints.push({ synergyName: synergy.name, tier: "active", emoji: synergy.emoji });
    }
  }

  return hints;
}
