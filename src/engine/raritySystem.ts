import { ItemRarity, RARITY_CONFIG } from "@/types/item";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";

/**
 * Rarity System
 *
 * Handles weighted random selection of item rarity
 * Based on drop weights from RARITY_CONFIG
 */

/**
 * Roll for item rarity using weighted random selection
 *
 * @param rng - Random number generator
 * @returns Selected rarity tier
 */
export function rollItemRarity(
  rng: RandomProvider = getDefaultRandomProvider()
): ItemRarity {
  const rarities: ItemRarity[] = [
    "junk",
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
  ];

  // Build cumulative weight table
  const weights = rarities.map((r) => RARITY_CONFIG[r].dropWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Roll random number
  const roll = rng.random() * totalWeight;

  // Find which rarity tier the roll lands in
  let cumulative = 0;
  for (let i = 0; i < rarities.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) {
      return rarities[i];
    }
  }

  // Fallback (should never reach)
  return "common";
}

/**
 * Get rarity color class for UI
 */
export function getRarityColor(rarity: ItemRarity): string {
  return RARITY_CONFIG[rarity].color;
}

/**
 * Get rarity stat multiplier
 */
export function getRarityMultiplier(rarity: ItemRarity): number {
  return RARITY_CONFIG[rarity].statMultiplier;
}

/**
 * Calculate item stat bonus based on rarity and base value
 *
 * @param baseValue - Base stat value before rarity multiplier
 * @param rarity - Item rarity tier
 * @returns Final stat bonus
 */
export function calculateItemStatBonus(
  baseValue: number,
  rarity: ItemRarity
): number {
  const multiplier = getRarityMultiplier(rarity);
  return Math.round(baseValue * multiplier * 10) / 10; // Round to 1 decimal
}

/**
 * Check if rarity should show glow effect
 */
export function shouldItemGlow(rarity: ItemRarity): boolean {
  return RARITY_CONFIG[rarity].glowIntensity > 0;
}
