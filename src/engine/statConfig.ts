/**
 * Stat Configuration System
 *
 * Central source of truth for all player stat ranges, meanings, and thresholds.
 * This ensures consistency across generation, simulation, display, and game balance.
 *
 * IMPORTANT: All code that deals with player stats should reference these values,
 * not hardcode magic numbers.
 */

import { BatterStats, PitcherStats } from "@/types/game";

/**
 * Stat ranges define the valid min/max values for each stat
 * These are the ABSOLUTE bounds - no stat should exist outside these ranges
 */
export const STAT_RANGES = {
  BATTER: {
    POWER: { min: 0, max: 100 },
    CONTACT: { min: 0, max: 100 },
    GLOVE: { min: 0, max: 100 },
    SPEED: { min: 0, max: 100 },
  },
  PITCHER: {
    VELOCITY: { min: 0, max: 100 },
    CONTROL: { min: 0, max: 100 },
    BREAK: { min: 0, max: 100 },
  },
} as const;

/**
 * Stat tiers define player quality levels with semantic meaning
 *
 * These ranges determine player archetypes:
 * - POOR (0-30): Weak in this area, exploitable
 * - AVERAGE (30-45): League average, replacement level
 * - SOLID (45-60): Above average, reliable contributor
 * - GOOD (60-75): Strong performer, consistent quality
 * - GREAT (75-87): Star quality, game-changing
 * - ELITE (87-100): Hall of Fame tier, dominant
 */
export const STAT_TIERS = {
  POOR: { min: 0, max: 30 },
  AVERAGE: { min: 30, max: 45 },
  SOLID: { min: 45, max: 60 },
  GOOD: { min: 60, max: 75 },
  GREAT: { min: 75, max: 87 },
  ELITE: { min: 87, max: 100 },
} as const;

/**
 * Stat meanings - what each stat represents and how it affects gameplay
 */
export const STAT_DESCRIPTIONS = {
  BATTER: {
    POWER: {
      name: "Power",
      shortCode: "PWR",
      description: "Home run and extra-base hitting ability",
      effect: "Higher power = more home runs, doubles, triples",
    },
    CONTACT: {
      name: "Contact",
      shortCode: "CON",
      description: "Ability to make contact and get on base",
      effect: "Higher contact = more singles, fewer strikeouts",
    },
    GLOVE: {
      name: "Glove",
      shortCode: "GLV",
      description: "Defensive fielding ability",
      effect: "Higher glove = fewer errors, better team defense",
    },
    SPEED: {
      name: "Speed",
      shortCode: "SPD",
      description: "Baserunning speed and extra base taking",
      effect: "Higher speed = more extra bases taken, 1st to 3rd on singles",
    },
  },
  PITCHER: {
    VELOCITY: {
      name: "Velocity",
      shortCode: "VEL",
      description: "Fastball speed and strikeout power",
      effect: "Higher velocity = more strikeouts, fewer hits",
    },
    CONTROL: {
      name: "Control",
      shortCode: "CTL",
      description: "Strike accuracy and walk prevention",
      effect: "Higher control = fewer walks, more outs",
    },
    BREAK: {
      name: "Break",
      shortCode: "BRK",
      description: "Breaking ball movement and deception",
      effect: "Higher break = more weak contact, fewer home runs",
    },
  },
} as const;

/**
 * Player generation templates by quality tier
 * These define typical stat distributions for different player archetypes
 */
export const PLAYER_GENERATION_TEMPLATES = {
  BATTER: {
    // Rookie / Low-tier player (minor league quality)
    ROOKIE: {
      POWER: { min: 15, max: 35 },
      CONTACT: { min: 10, max: 30 },
      GLOVE: { min: 10, max: 30 },
      SPEED: { min: 15, max: 40 },
    },
    // Average starter (replacement level)
    AVERAGE: {
      POWER: { min: 30, max: 48 },
      CONTACT: { min: 28, max: 46 },
      GLOVE: { min: 28, max: 46 },
      SPEED: { min: 30, max: 50 },
    },
    // Solid player (above average, dependable)
    SOLID: {
      POWER: { min: 45, max: 62 },
      CONTACT: { min: 43, max: 60 },
      GLOVE: { min: 43, max: 60 },
      SPEED: { min: 35, max: 60 },
    },
    // Good player (strong starter)
    GOOD: {
      POWER: { min: 60, max: 77 },
      CONTACT: { min: 58, max: 75 },
      GLOVE: { min: 58, max: 75 },
      SPEED: { min: 40, max: 70 },
    },
    // Star player (all-star quality)
    STAR: {
      POWER: { min: 73, max: 88 },
      CONTACT: { min: 71, max: 86 },
      GLOVE: { min: 68, max: 83 },
      SPEED: { min: 50, max: 80 },
    },
    // Elite player (MVP/Hall of Fame)
    ELITE: {
      POWER: { min: 85, max: 98 },
      CONTACT: { min: 83, max: 96 },
      GLOVE: { min: 80, max: 93 },
      SPEED: { min: 60, max: 90 },
    },
  },
  PITCHER: {
    // Rookie / Low-tier pitcher
    ROOKIE: {
      VELOCITY: { min: 15, max: 35 },
      CONTROL: { min: 10, max: 30 },
      BREAK: { min: 10, max: 30 },
    },
    // Average pitcher (replacement level)
    AVERAGE: {
      VELOCITY: { min: 30, max: 48 },
      CONTROL: { min: 28, max: 46 },
      BREAK: { min: 28, max: 46 },
    },
    // Solid pitcher (dependable arm)
    SOLID: {
      VELOCITY: { min: 45, max: 62 },
      CONTROL: { min: 43, max: 60 },
      BREAK: { min: 43, max: 60 },
    },
    // Good pitcher (quality starter/closer)
    GOOD: {
      VELOCITY: { min: 60, max: 77 },
      CONTROL: { min: 58, max: 75 },
      BREAK: { min: 58, max: 75 },
    },
    // Star pitcher (Cy Young candidate)
    STAR: {
      VELOCITY: { min: 73, max: 88 },
      CONTROL: { min: 71, max: 86 },
      BREAK: { min: 71, max: 86 },
    },
    // Elite pitcher (Hall of Fame tier)
    ELITE: {
      VELOCITY: { min: 85, max: 98 },
      CONTROL: { min: 83, max: 96 },
      BREAK: { min: 83, max: 96 },
    },
  },
} as const;

/**
 * Stat thresholds used in simulation logic
 * These define breakpoints for gameplay decisions
 */
export const SIMULATION_THRESHOLDS = {
  // At what stat level does a batter become "dangerous" for power?
  POWER_THREAT: 70,
  // At what contact level does strikeout rate significantly drop?
  CONTACT_SAFE: 55,
  // At what velocity does a pitcher dominate?
  VELOCITY_DOMINANT: 75,
  // At what control level do walks become rare?
  CONTROL_EXCELLENT: 65,
  // Defensive stat that significantly impacts team defense
  DEFENSE_IMPACT: 60,
} as const;

/**
 * Validation utilities
 */

export function isValidBatterStat(stat: keyof BatterStats, value: number): boolean {
  const range = STAT_RANGES.BATTER[stat.toUpperCase() as keyof typeof STAT_RANGES.BATTER];
  return value >= range.min && value <= range.max;
}

export function isValidPitcherStat(stat: keyof PitcherStats, value: number): boolean {
  const range = STAT_RANGES.PITCHER[stat.toUpperCase() as keyof typeof STAT_RANGES.PITCHER];
  return value >= range.min && value <= range.max;
}

export function isValidBatterStats(stats: BatterStats): boolean {
  return (
    isValidBatterStat("power", stats.power) &&
    isValidBatterStat("contact", stats.contact) &&
    isValidBatterStat("glove", stats.glove) &&
    isValidBatterStat("speed", stats.speed)
  );
}

export function isValidPitcherStats(stats: PitcherStats): boolean {
  return (
    isValidPitcherStat("velocity", stats.velocity) &&
    isValidPitcherStat("control", stats.control) &&
    isValidPitcherStat("break", stats.break)
  );
}

/**
 * Clamp a stat value to valid range
 */
export function clampBatterStat(stat: keyof BatterStats, value: number): number {
  const range = STAT_RANGES.BATTER[stat.toUpperCase() as keyof typeof STAT_RANGES.BATTER];
  return Math.max(range.min, Math.min(range.max, Math.floor(value)));
}

export function clampPitcherStat(stat: keyof PitcherStats, value: number): number {
  const range = STAT_RANGES.PITCHER[stat.toUpperCase() as keyof typeof STAT_RANGES.PITCHER];
  return Math.max(range.min, Math.min(range.max, Math.floor(value)));
}

/**
 * Get tier label for a stat value
 */
export function getStatTier(value: number): keyof typeof STAT_TIERS {
  if (value >= STAT_TIERS.ELITE.min) return "ELITE";
  if (value >= STAT_TIERS.GREAT.min) return "GREAT";
  if (value >= STAT_TIERS.GOOD.min) return "GOOD";
  if (value >= STAT_TIERS.SOLID.min) return "SOLID";
  if (value >= STAT_TIERS.AVERAGE.min) return "AVERAGE";
  return "POOR";
}

/**
 * Stat tier color configuration
 * Defines consistent color mapping across the entire UI
 */
export const STAT_TIER_COLORS = {
  ELITE: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/20",
    border: "border-purple-500 dark:border-purple-400",
    badge: "bg-purple-600 text-white",
  },
  GREAT: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/20",
    border: "border-blue-500 dark:border-blue-400",
    badge: "bg-blue-600 text-white",
  },
  GOOD: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/20",
    border: "border-green-500 dark:border-green-400",
    badge: "bg-green-600 text-white",
  },
  SOLID: {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-100 dark:bg-teal-900/20",
    border: "border-teal-500 dark:border-teal-400",
    badge: "bg-teal-600 text-white",
  },
  AVERAGE: {
    text: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-900/20",
    border: "border-gray-500 dark:border-gray-400",
    badge: "bg-gray-600 text-white",
  },
  POOR: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/20",
    border: "border-red-500 dark:border-red-400",
    badge: "bg-red-600 text-white",
  },
} as const;

/**
 * Get display color for stat value (for UI)
 * @param value - Stat value (0-100)
 * @param variant - Color variant to use (default: "text")
 */
export function getStatTierColor(
  value: number,
  variant: keyof typeof STAT_TIER_COLORS.ELITE = "text"
): string {
  const tier = getStatTier(value);
  return STAT_TIER_COLORS[tier][variant];
}

/**
 * Get stat color with font weight for display
 * Legacy function for backward compatibility
 */
export function getStatColor(value: number): string {
  const tier = getStatTier(value);
  switch (tier) {
    case "ELITE":
      return "text-purple-600 dark:text-purple-400 font-bold";
    case "GREAT":
      return "text-blue-600 dark:text-blue-400 font-bold";
    case "GOOD":
      return "text-green-600 dark:text-green-400 font-semibold";
    case "SOLID":
      return "text-teal-600 dark:text-teal-400 font-medium";
    case "AVERAGE":
      return "text-gray-600 dark:text-gray-400 font-medium";
    case "POOR":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Calculate overall rating for a batter (0-100)
 */
export function getBatterOverall(stats: BatterStats): number {
  // Weighted average: Power and contact most impactful, speed and glove secondary
  const weighted = stats.power * 0.3 + stats.contact * 0.3 + stats.glove * 0.2 + stats.speed * 0.2;
  return Math.floor(weighted);
}

/**
 * Calculate overall rating for a pitcher (0-100)
 */
export function getPitcherOverall(stats: PitcherStats): number {
  // Weighted average: All stats roughly equal importance
  const weighted = stats.velocity * 0.35 + stats.control * 0.35 + stats.break * 0.3;
  return Math.floor(weighted);
}

/**
 * Type for player quality tiers
 */
export type PlayerQualityTier = keyof typeof PLAYER_GENERATION_TEMPLATES.BATTER;

/**
 * Get stat ranges for a quality tier
 */
export function getBatterStatRanges(tier: PlayerQualityTier) {
  return PLAYER_GENERATION_TEMPLATES.BATTER[tier];
}

export function getPitcherStatRanges(tier: PlayerQualityTier) {
  return PLAYER_GENERATION_TEMPLATES.PITCHER[tier];
}
