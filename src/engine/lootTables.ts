import { EquipmentSlot } from "@/types/item";

/**
 * Loot Tables - Procedural Name Generation Data
 *
 * Format: [Prefix] + [Base] + [Suffix]
 * Example: "Furious Aluminum Bat of Storms"
 */

// ============================================
// PREFIXES (affect item stats theme)
// ============================================

export interface PrefixData {
  name: string;
  statTheme: "power" | "contact" | "defense" | "speed";
}

export const ITEM_PREFIXES: PrefixData[] = [
  // Power prefixes
  { name: "Furious", statTheme: "power" },
  { name: "Mighty", statTheme: "power" },
  { name: "Devastating", statTheme: "power" },
  { name: "Titanium", statTheme: "power" },
  { name: "Crushing", statTheme: "power" },
  { name: "Thunderous", statTheme: "power" },
  { name: "Brutal", statTheme: "power" },

  // Contact prefixes
  { name: "Precise", statTheme: "contact" },
  { name: "Keen", statTheme: "contact" },
  { name: "Sharp", statTheme: "contact" },
  { name: "Focused", statTheme: "contact" },
  { name: "Quick", statTheme: "contact" },
  { name: "Accurate", statTheme: "contact" },

  // Defense prefixes
  { name: "Sturdy", statTheme: "defense" },
  { name: "Reinforced", statTheme: "defense" },
  { name: "Guardian's", statTheme: "defense" },
  { name: "Protective", statTheme: "defense" },
  { name: "Iron", statTheme: "defense" },
  { name: "Fortified", statTheme: "defense" },

  // Speed prefixes
  { name: "Swift", statTheme: "speed" },
  { name: "Lightning", statTheme: "speed" },
  { name: "Agile", statTheme: "speed" },
  { name: "Fleet", statTheme: "speed" },
  { name: "Blazing", statTheme: "speed" },
];

// ============================================
// BASE ITEMS (by slot type)
// ============================================

export interface BaseItemData {
  name: string;
  slot: EquipmentSlot;
  requiredRole?: "Batter" | "Starter" | "Reliever"; // If role-specific
}

// Bat slot - Bats
export const BATTER_MAIN_HAND: BaseItemData[] = [
  { name: "Wooden Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Aluminum Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Maple Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Ash Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Composite Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Louisville Slugger", slot: "bat", requiredRole: "Batter" },
  { name: "Steel Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Carbon Fiber Bat", slot: "bat", requiredRole: "Batter" },
  { name: "Bamboo Bat", slot: "bat", requiredRole: "Batter" },
];

// Bat slot - Pitch grips (for pitchers)
export const PITCHER_MAIN_HAND: BaseItemData[] = [
  { name: "Fastball Grip", slot: "bat", requiredRole: "Starter" },
  { name: "Curveball Grip", slot: "bat", requiredRole: "Starter" },
  { name: "Slider Grip", slot: "bat", requiredRole: "Starter" },
  { name: "Knuckleball Grip", slot: "bat", requiredRole: "Starter" },
  { name: "Sinker Grip", slot: "bat", requiredRole: "Reliever" },
  { name: "Splitter Grip", slot: "bat", requiredRole: "Reliever" },
  { name: "Changeup Grip", slot: "bat", requiredRole: "Reliever" },
  { name: "Cutter Grip", slot: "bat", requiredRole: "Reliever" },
  { name: "Two-Seam Grip", slot: "bat", requiredRole: "Starter" },
  { name: "Four-Seam Grip", slot: "bat", requiredRole: "Starter" },
];

// Glove slot
export const GLOVES: BaseItemData[] = [
  { name: "Leather Glove", slot: "glove" },
  { name: "First Baseman's Mitt", slot: "glove" },
  { name: "Catcher's Mitt", slot: "glove" },
  { name: "Fielder's Glove", slot: "glove" },
  { name: "Outfielder's Glove", slot: "glove" },
  { name: "Infielder's Glove", slot: "glove" },
  { name: "Pitcher's Glove", slot: "glove" },
  { name: "Premium Leather Glove", slot: "glove" },
  { name: "Gold Glove", slot: "glove" },
];

// Cap slot - Caps & Helmets
export const HEADGEAR: BaseItemData[] = [
  { name: "Baseball Cap", slot: "cap" },
  { name: "Batting Helmet", slot: "cap" },
  { name: "Vintage Cap", slot: "cap" },
  { name: "Visor", slot: "cap" },
  { name: "Fitted Cap", slot: "cap" },
  { name: "Snapback", slot: "cap" },
  { name: "Trucker Hat", slot: "cap" },
  { name: "Adjustable Cap", slot: "cap" },
];

// Cleats slot
export const FOOTWEAR: BaseItemData[] = [
  { name: "Metal Cleats", slot: "cleats" },
  { name: "Turf Shoes", slot: "cleats" },
  { name: "Molded Cleats", slot: "cleats" },
  { name: "Low-Top Cleats", slot: "cleats" },
  { name: "High-Top Cleats", slot: "cleats" },
  { name: "Running Shoes", slot: "cleats" },
  { name: "Spikes", slot: "cleats" },
];

// Accessory - Misc
export const ACCESSORIES: BaseItemData[] = [
  { name: "Sunglasses", slot: "accessory" },
  { name: "Gold Chain", slot: "accessory" },
  { name: "Wristband", slot: "accessory" },
  { name: "Batting Gloves", slot: "accessory" },
  { name: "Pine Tar Rag", slot: "accessory" },
  { name: "Lucky Charm", slot: "accessory" },
  { name: "Eye Black", slot: "accessory" },
  { name: "Bubble Gum", slot: "accessory" },
  { name: "Compression Sleeve", slot: "accessory" },
  { name: "Headband", slot: "accessory" },
];

// ============================================
// SUFFIXES (add themed bonuses)
// ============================================

export interface SuffixData {
  name: string;
  statTheme: "power" | "contact" | "defense" | "speed" | "special";
}

export const ITEM_SUFFIXES: SuffixData[] = [
  // Power suffixes
  { name: "of the Bull", statTheme: "power" },
  { name: "of Storms", statTheme: "power" },
  { name: "of Thunder", statTheme: "power" },
  { name: "of the Titan", statTheme: "power" },
  { name: "of Devastation", statTheme: "power" },
  { name: "of Might", statTheme: "power" },

  // Contact suffixes
  { name: "of the Hawk", statTheme: "contact" },
  { name: "of Precision", statTheme: "contact" },
  { name: "of the Sniper", statTheme: "contact" },
  { name: "of Focus", statTheme: "contact" },
  { name: "of Accuracy", statTheme: "contact" },

  // Defense suffixes
  { name: "of the Wall", statTheme: "defense" },
  { name: "of Protection", statTheme: "defense" },
  { name: "of the Guardian", statTheme: "defense" },
  { name: "of Fortitude", statTheme: "defense" },
  { name: "of the Shield", statTheme: "defense" },

  // Speed suffixes
  { name: "of the Cheetah", statTheme: "speed" },
  { name: "of Wind", statTheme: "speed" },
  { name: "of Lightning", statTheme: "speed" },
  { name: "of Haste", statTheme: "speed" },
  { name: "of Swiftness", statTheme: "speed" },

  // Special suffixes (rare, humorous)
  { name: "of the Vampire", statTheme: "special" }, // Life steal flavor
  { name: "of Bad Value", statTheme: "special" }, // Humor - big salary
  { name: "of the Rookie", statTheme: "special" }, // +XP gain
  { name: "of the Legend", statTheme: "special" }, // Prestige bonus
  { name: "of Destiny", statTheme: "special" },
  { name: "of Glory", statTheme: "special" },
];

// ============================================
// FLAVOR TEXT POOL
// ============================================

export const FLAVOR_TEXT_POOL: string[] = [
  "Forged in the fires of competitive spirit.",
  "This item has seen better days.",
  "Legends say this belonged to a Hall of Famer.",
  "You can feel the power radiating from it.",
  "It's sticky. Don't ask why.",
  "Smells like championship dreams.",
  "The previous owner hit .400 with this.",
  "Banned in 37 states for being too powerful.",
  "It's not cheating if you don't get caught.",
  "Your teammates will be jealous.",
  "Scientifically proven to improve performance by 0.2%.",
  "The baseball gods smile upon this item.",
  "It once belonged to an actual cow. The stats are udderly ridiculous.",
  "This item violates the laws of physics. And fashion.",
  "Guaranteed to make you look cool. Results may vary.",
  "Found in a dumpster behind the stadium.",
  "Touched by an angel. Or maybe just a fan.",
  "Warning: May cause excessive celebration.",
  "Side effects include swagger and confidence.",
  "Not responsible for inflated egos.",
];
