import {
  Item,
  ItemRarity,
  EquipmentSlot,
  ItemStats,
  RARITY_CONFIG,
} from "@/types/item";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";
import { rollItemRarity, calculateItemStatBonus } from "./raritySystem";
import {
  ITEM_PREFIXES,
  ITEM_SUFFIXES,
  BATTER_MAIN_HAND,
  PITCHER_MAIN_HAND,
  GLOVES,
  HEADGEAR,
  FOOTWEAR,
  ACCESSORIES,
  FLAVOR_TEXT_POOL,
  BaseItemData,
} from "./lootTables";

/**
 * Loot Generation Engine
 *
 * Generates procedural items with:
 * - Weighted rarity selection
 * - Prefix + Base + Suffix naming
 * - Role-appropriate items
 * - Level-scaled stats
 */

// ============================================
// ITEM GENERATION
// ============================================

/**
 * Generate a random item for a player
 *
 * @param playerRole - Player's role (determines valid items)
 * @param playerLevel - Player's current level (scales item stats)
 * @param rng - Random number generator
 * @param forceRarity - Optional: force specific rarity (for testing)
 * @returns Generated item
 */
export function generateItem(
  playerRole: "Batter" | "Starter" | "Reliever",
  playerLevel: number,
  rng: RandomProvider = getDefaultRandomProvider(),
  forceRarity?: ItemRarity
): Item {
  // Roll for rarity
  const rarity = forceRarity || rollItemRarity(rng);

  // Select random slot
  const slot = rollEquipmentSlot(rng);

  // Get base item for slot and role
  const baseItem = rollBaseItem(slot, playerRole, rng);

  // Roll for prefix (60% chance)
  const prefix = rng.random() < 0.6
    ? ITEM_PREFIXES[rng.randomIntInclusive(0, ITEM_PREFIXES.length - 1)]
    : undefined;

  // Roll for suffix (40% chance, higher for rare+ items)
  const suffixChance = rarity === "junk" || rarity === "common" ? 0.4 : 0.7;
  const suffix = rng.random() < suffixChance
    ? ITEM_SUFFIXES[rng.randomIntInclusive(0, ITEM_SUFFIXES.length - 1)]
    : undefined;

  // Build procedural name
  const name = buildItemName(prefix?.name, baseItem.name, suffix?.name);

  // Generate stats based on slot, role, level, and rarity
  const stats = generateItemStats(
    slot,
    playerRole,
    playerLevel,
    rarity,
    prefix,
    suffix,
    rng
  );

  // Calculate sell value
  const sellValue = calculateSellValue(playerLevel, rarity);

  // Random flavor text (20% chance for rare+)
  const flavorText = rarity !== "junk" && rarity !== "common" && rng.random() < 0.2
    ? FLAVOR_TEXT_POOL[rng.randomIntInclusive(0, FLAVOR_TEXT_POOL.length - 1)]
    : undefined;

  return {
    id: generateItemId(),
    name,
    slot,
    rarity,
    stats,
    prefix: prefix?.name,
    base: baseItem.name,
    suffix: suffix?.name,
    itemLevel: playerLevel,
    sellValue,
    flavorText,
  };
}

/**
 * Roll for random equipment slot
 */
function rollEquipmentSlot(rng: RandomProvider): EquipmentSlot {
  const slots: EquipmentSlot[] = [
    "bat",
    "glove",
    "cap",
    "cleats",
    "accessory",
  ];
  return slots[rng.randomIntInclusive(0, slots.length - 1)];
}

/**
 * Get base item data for slot and role
 */
function rollBaseItem(
  slot: EquipmentSlot,
  playerRole: "Batter" | "Starter" | "Reliever",
  rng: RandomProvider
): BaseItemData {
  let pool: BaseItemData[] = [];

  switch (slot) {
    case "bat":
      pool = playerRole === "Batter" ? BATTER_MAIN_HAND : PITCHER_MAIN_HAND;
      break;
    case "glove":
      pool = GLOVES;
      break;
    case "cap":
      pool = HEADGEAR;
      break;
    case "cleats":
      pool = FOOTWEAR;
      break;
    case "accessory":
      pool = ACCESSORIES;
      break;
  }

  return pool[rng.randomIntInclusive(0, pool.length - 1)];
}

/**
 * Build item name from components
 */
function buildItemName(
  prefix?: string,
  base?: string,
  suffix?: string
): string {
  const parts: string[] = [];

  if (prefix) parts.push(prefix);
  if (base) parts.push(base);
  if (suffix) parts.push(suffix);

  return parts.join(" ");
}

/**
 * Generate item stats based on context
 */
function generateItemStats(
  slot: EquipmentSlot,
  playerRole: "Batter" | "Starter" | "Reliever",
  playerLevel: number,
  rarity: ItemRarity,
  _prefix: any, // Reserved for future prefix-based stat modifications
  _suffix: any, // Reserved for future suffix-based stat modifications
  rng: RandomProvider
): ItemStats {
  const stats: ItemStats = {};

  // Base stat value scales with player level
  // Level 1: 1-3 stats
  // Level 10: 3-8 stats
  // Level 50: 10-20 stats
  const baseMin = 1 + Math.floor(playerLevel / 5);
  const baseMax = 3 + Math.floor(playerLevel / 2.5);

  const rollStat = () => rng.randomIntInclusive(baseMin, baseMax);

  // Role-specific stats
  if (playerRole === "Batter") {
    // Batters get power/contact/glove (speed comes from feet slot)
    stats.power = calculateItemStatBonus(rollStat(), rarity);
    stats.contact = calculateItemStatBonus(rollStat(), rarity);
    stats.glove = calculateItemStatBonus(rollStat(), rarity);
    // Feet slot items grant speed bonus
    if (slot === "cleats") {
      stats.speed = calculateItemStatBonus(rollStat(), rarity);
    }
  } else {
    // Pitchers get velocity/control/break
    stats.velocity = calculateItemStatBonus(rollStat(), rarity);
    stats.control = calculateItemStatBonus(rollStat(), rarity);
    stats.break = calculateItemStatBonus(rollStat(), rarity);
  }

  // Slot bonuses
  if (slot === "accessory" && rng.random() < 0.3) {
    // Accessories sometimes give XP bonus
    stats.xpBonus = Math.round(rarity === "legendary" ? 20 :
                               rarity === "epic" ? 10 :
                               rarity === "rare" ? 5 : 2);
  }

  return stats;
}

/**
 * Calculate item sell value
 */
function calculateSellValue(itemLevel: number, rarity: ItemRarity): number {
  const baseValue = 10 + itemLevel * 5;
  const rarityMultiplier = RARITY_CONFIG[rarity].statMultiplier;
  return Math.floor(baseValue * rarityMultiplier);
}

/**
 * Generate unique item ID
 */
function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// LOOT DROP TRIGGERS
// ============================================

/**
 * Calculate loot drop chance based on play outcome
 *
 * Balanced drop rates:
 * - Home Run: 30% drop chance
 * - Triple: 20% drop chance
 * - Double: 10% drop chance
 * - Single: 5% drop chance
 * - Win bonus: 100% (guaranteed drop)
 */
export function getLootDropChance(
  outcome: "single" | "double" | "triple" | "homerun" | "win"
): number {
  switch (outcome) {
    case "homerun":
      return 0.30;
    case "triple":
      return 0.20;
    case "double":
      return 0.10;
    case "single":
      return 0.05;
    case "win":
      return 1.0; // Guaranteed
    default:
      return 0;
  }
}

/**
 * Roll for loot drop
 *
 * @returns true if loot should drop
 */
export function shouldDropLoot(
  outcome: "single" | "double" | "triple" | "homerun" | "win",
  rng: RandomProvider = getDefaultRandomProvider()
): boolean {
  const chance = getLootDropChance(outcome);
  return rng.random() < chance;
}
