/**
 * Item System Types
 *
 * Design Philosophy:
 * - Items are procedurally generated with rarity-based stat multipliers
 * - Each item has a slot type (main hand, off hand, etc.)
 * - Stat bonuses stack with player's base stats
 * - Higher rarity = bigger stat bonuses
 */

// ============================================
// RARITY SYSTEM
// ============================================

export type ItemRarity =
  | "junk"      // Gray - 0.5x multiplier
  | "common"    // White - 1.0x multiplier
  | "uncommon"  // Green - 1.25x multiplier
  | "rare"      // Blue - 1.5x multiplier
  | "epic"      // Purple - 2.5x multiplier
  | "legendary"; // Orange - 5.0x multiplier

export interface RarityConfig {
  name: string;
  color: string; // Tailwind color class
  dropWeight: number; // Relative drop chance
  statMultiplier: number;
  glowIntensity: number; // For visual effects
}

export const RARITY_CONFIG: Record<ItemRarity, RarityConfig> = {
  junk: {
    name: "Junk",
    color: "text-zinc-500 dark:text-zinc-400",
    dropWeight: 40,
    statMultiplier: 0.5,
    glowIntensity: 0,
  },
  common: {
    name: "Common",
    color: "text-slate-500 dark:text-slate-300",
    dropWeight: 30,
    statMultiplier: 1.0,
    glowIntensity: 0,
  },
  uncommon: {
    name: "Uncommon",
    color: "text-emerald-600 dark:text-emerald-400",
    dropWeight: 15,
    statMultiplier: 1.25,
    glowIntensity: 1,
  },
  rare: {
    name: "Rare",
    color: "text-sky-600 dark:text-sky-400",
    dropWeight: 10,
    statMultiplier: 1.5,
    glowIntensity: 2,
  },
  epic: {
    name: "Epic",
    color: "text-violet-600 dark:text-violet-400",
    dropWeight: 4,
    statMultiplier: 2.0,
    glowIntensity: 3,
  },
  legendary: {
    name: "Legendary",
    color: "text-amber-600 dark:text-amber-400",
    dropWeight: 1,
    statMultiplier: 3.0,
    glowIntensity: 4,
  },
};

// ============================================
// EQUIPMENT SLOTS
// ============================================

export type EquipmentSlot =
  | "bat"        // Bat (batters) / Pitch grip (pitchers)
  | "glove"      // Fielding glove
  | "cap"        // Cap / Batting helmet
  | "cleats"     // Cleats / turf shoes
  | "accessory"; // Sunglasses, chains, gum

export const EQUIPMENT_SLOT_NAMES: Record<EquipmentSlot, string> = {
  bat: "Bat",
  glove: "Glove",
  cap: "Cap",
  cleats: "Cleats",
  accessory: "Accessory",
};

// Role-aware display name for the bat slot
export function getBatSlotName(role: string): string {
  return role === "Batter" ? "Bat" : "Grip";
}

// ============================================
// ITEM STAT BONUSES
// ============================================

export interface ItemStats {
  // Batter stats
  power?: number;
  contact?: number;
  glove?: number;
  speed?: number;

  // Pitcher stats
  velocity?: number;
  control?: number;
  break?: number;

  // Universal stats
  xpBonus?: number; // % XP gain increase
}

// ============================================
// ITEM INTERFACE
// ============================================

export interface Item {
  id: string;
  name: string; // Procedurally generated: "Furious Aluminum Bat of Storms"
  slot: EquipmentSlot;
  rarity: ItemRarity;
  stats: ItemStats;

  // Procedural name components (for display/lore)
  prefix?: string;  // "Furious"
  base: string;     // "Aluminum Bat"
  suffix?: string;  // "of Storms"

  // Metadata
  itemLevel: number; // Scales with player level when dropped
  sellValue: number; // Gold value when sold
  flavorText?: string; // Optional lore/humor
}

// ============================================
// INVENTORY
// ============================================

export interface InventorySlot {
  item: Item | null;
}

export const INVENTORY_SIZE = 50;

// ============================================
// EQUIPPED ITEMS
// ============================================

export type EquippedItems = {
  [K in EquipmentSlot]: Item | null;
};

// ============================================
// LOOT DROP
// ============================================

export interface LootDrop {
  item: Item;
  triggeredBy: "single" | "double" | "triple" | "homerun" | "win";
  playerName: string;
}
