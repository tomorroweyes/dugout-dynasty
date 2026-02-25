import { Player, BatterStats, PitcherStats, isBatter } from "@/types/game";
import { Item, ItemStats, EquippedItems } from "@/types/item";
import { calculateDerivedStats } from "./techniqueStats";

/**
 * Item Stats Calculator
 *
 * Calculates total player stats including:
 * - Archetype base stats
 * - Technique bonuses
 * - Equipment bonuses
 */

/**
 * Calculate total stats for a player including all bonuses
 *
 * Now uses the technique system to derive stats from:
 * - Archetype base stats
 * - Equipped techniques
 * - Equipped items
 *
 * @param player - The player to calculate stats for
 * @returns Total stats including all bonuses
 */
export function calculatePlayerStatsWithEquipment(
  player: Player
): BatterStats | PitcherStats {
  // Use derived stats calculation (archetype + techniques + equipment)
  return calculateDerivedStats(player);
}

/**
 * Calculate total XP bonus percentage from equipment
 *
 * @param equipment - Equipped items
 * @returns Total XP bonus percentage (e.g., 15 for 15% bonus)
 */
export function calculateXpBonus(equipment: EquippedItems): number {
  let xpBonus = 0;

  Object.values(equipment).forEach((item) => {
    if (item && item.stats.xpBonus) {
      xpBonus += item.stats.xpBonus;
    }
  });

  return xpBonus;
}

/**
 * Calculate sum of all equipment bonuses
 *
 * @param equipment - Equipped items
 * @returns Aggregated item stats
 */
export function calculateEquipmentBonuses(
  equipment: EquippedItems
): ItemStats {
  const bonuses: ItemStats = {};

  Object.values(equipment).forEach((item) => {
    if (!item) return;

    // Aggregate all stat bonuses
    if (item.stats.power) {
      bonuses.power = (bonuses.power || 0) + item.stats.power;
    }
    if (item.stats.contact) {
      bonuses.contact = (bonuses.contact || 0) + item.stats.contact;
    }
    if (item.stats.glove) {
      bonuses.glove = (bonuses.glove || 0) + item.stats.glove;
    }
    if (item.stats.speed) {
      bonuses.speed = (bonuses.speed || 0) + item.stats.speed;
    }
    if (item.stats.velocity) {
      bonuses.velocity = (bonuses.velocity || 0) + item.stats.velocity;
    }
    if (item.stats.control) {
      bonuses.control = (bonuses.control || 0) + item.stats.control;
    }
    if (item.stats.break) {
      bonuses.break = (bonuses.break || 0) + item.stats.break;
    }
    if (item.stats.xpBonus) {
      bonuses.xpBonus = (bonuses.xpBonus || 0) + item.stats.xpBonus;
    }
  });

  return bonuses;
}

/**
 * Get a formatted string showing stat comparison between equipped and new item
 *
 * @param currentItem - Currently equipped item (or null)
 * @param newItem - Item to compare
 * @returns Object with stat differences for display
 */
export function compareItems(
  currentItem: Item | null,
  newItem: Item
): {
  better: string[];
  worse: string[];
  same: string[];
} {
  const better: string[] = [];
  const worse: string[] = [];
  const same: string[] = [];

  const currentStats = currentItem?.stats || {};
  const newStats = newItem.stats;

  // Compare all possible stats
  const statKeys: Array<keyof ItemStats> = [
    "power",
    "contact",
    "glove",
    "speed",
    "velocity",
    "control",
    "break",
    "xpBonus",
  ];

  statKeys.forEach((key) => {
    const currentValue = currentStats[key] || 0;
    const newValue = newStats[key] || 0;

    if (newValue > 0) {
      // Only compare if the new item has this stat
      if (newValue > currentValue) {
        better.push(`+${newValue - currentValue} ${key}`);
      } else if (newValue < currentValue) {
        worse.push(`${newValue - currentValue} ${key}`);
      } else if (currentValue > 0) {
        same.push(`=${newValue} ${key}`);
      }
    }
  });

  return { better, worse, same };
}
