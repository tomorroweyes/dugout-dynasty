import type { Ability } from "@/types/ability";
import {
  getTechniqueById,
  getTechniquesForArchetype,
  ALL_TECHNIQUES,
} from "@/data/techniques";

/**
 * Ability Lookup
 *
 * All abilities are defined in techniques.ts as the single source of truth.
 * This module provides lookup functions used throughout the codebase.
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all abilities for a specific class
 */
export function getAbilitiesForClass(className: string): Ability[] {
  return getTechniquesForArchetype(className);
}

/**
 * Get ability by ID
 */
export function getAbilityById(abilityId: string): Ability | undefined {
  return getTechniqueById(abilityId);
}

/**
 * Get base ability (rank 1) by ID
 */
export function getBaseAbility(abilityId: string): Ability | undefined {
  const ability = getAbilityById(abilityId);
  if (!ability) return undefined;
  return { ...ability, currentRank: 1 };
}

/**
 * Record of all abilities keyed by ID, for direct lookup
 */
export const ALL_ABILITIES: Record<string, Ability> = Object.fromEntries(
  ALL_TECHNIQUES.map((t) => [t.id, t])
);
