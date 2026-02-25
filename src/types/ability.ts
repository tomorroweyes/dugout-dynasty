/**
 * Ability System Types
 *
 * Design Philosophy:
 * - Abilities (Techniques) modify stats, probabilities, or outcomes during at-bats
 * - Each ability has a spirit cost and effects that stack with equipment/base stats
 * - Archetype-based progression with unlockable techniques
 * - Spirit resource replaces "mojo" terminology
 */

import type { BatterStats, PitcherStats } from "./game";

// ============================================
// PLAYER ARCHETYPE SYSTEM (Baseball Playing Styles)
// ============================================

export type PlayerArchetype =
  | "Slugger"          // Power hitter
  | "Contact Hitter"   // Contact specialist
  | "Speed Demon"      // Base stealer/speed
  | "Flamethrower"     // Dominant power pitcher
  | "Painter"          // Control/precision pitcher
  | "Trickster";       // Deception/breaking ball pitcher

// Backward compatibility alias
export type PlayerClass = PlayerArchetype;

export interface ArchetypeInfo {
  name: PlayerArchetype;
  displayName: string;
  description: string;
  baseStats: BatterStats | PitcherStats; // Starting stats for this archetype
  strengths: string[];
  availableFor: "batters" | "pitchers" | "all";
  iconEmoji: string;
}

const archetypeData = {
  Slugger: {
    name: "Slugger" as PlayerArchetype,
    displayName: "Slugger",
    description: "Power-focused hitter. Swings for the fences with devastating home run power.",
    baseStats: { power: 60, contact: 40, glove: 30, speed: 30 } as BatterStats,
    strengths: ["High Power", "Home Runs", "Extra Base Hits"],
    availableFor: "batters" as const,
    iconEmoji: "💪",
  },
  "Contact Hitter": {
    name: "Contact Hitter" as PlayerArchetype,
    displayName: "Contact Hitter",
    description: "Makes consistent contact. High batting average, rarely strikes out.",
    baseStats: { power: 30, contact: 65, glove: 40, speed: 45 } as BatterStats,
    strengths: ["High Contact", "Strong Defense", "Consistent Hitting"],
    availableFor: "batters" as const,
    iconEmoji: "🎯",
  },
  "Speed Demon": {
    name: "Speed Demon" as PlayerArchetype,
    displayName: "Speed Demon",
    description: "Speed specialist. Gets on base, steals bases, causes havoc.",
    baseStats: { power: 20, contact: 50, glove: 50, speed: 70 } as BatterStats,
    strengths: ["Speed", "Base Stealing", "Strategic Abilities"],
    availableFor: "batters" as const,
    iconEmoji: "⚡",
  },
  Flamethrower: {
    name: "Flamethrower" as PlayerArchetype,
    displayName: "Flamethrower",
    description: "Dominant power pitcher. Overwhelms batters with pure velocity and fear.",
    baseStats: { velocity: 70, control: 35, break: 30 } as PitcherStats,
    strengths: ["Raw Power", "Intimidation", "High-Leverage Dominance"],
    availableFor: "pitchers" as const,
    iconEmoji: "🔥",
  },
  Painter: {
    name: "Painter" as PlayerArchetype,
    displayName: "Painter",
    description: "Control specialist. Paints corners, induces weak contact, and never beats themselves.",
    baseStats: { velocity: 30, control: 65, break: 40 } as PitcherStats,
    strengths: ["Pinpoint Control", "Efficiency", "Weak Contact"],
    availableFor: "pitchers" as const,
    iconEmoji: "🎨",
  },
  Trickster: {
    name: "Trickster" as PlayerArchetype,
    displayName: "Trickster",
    description: "Deception specialist. A devastating arsenal of breaking balls that keeps batters off-balance and guessing.",
    baseStats: { velocity: 35, control: 35, break: 65 } as PitcherStats,
    strengths: ["Deception", "Unpredictability", "Breaking Balls"],
    availableFor: "pitchers" as const,
    iconEmoji: "🌀",
  },
};

export const ARCHETYPE_INFO: Record<PlayerArchetype, ArchetypeInfo> = archetypeData;

// Backward compatibility alias
export const CLASS_INFO = ARCHETYPE_INFO;

// ============================================
// ABILITY EFFECTS
// ============================================

export type AbilityEffectType =
  | "stat_modifier" // Temporary stat boost (e.g., +10 power)
  | "outcome_modifier" // Change outcome probabilities (e.g., +20% HR chance)
  | "guaranteed_outcome" // Force specific outcome (e.g., always bunt)
  | "defensive_boost"; // Boost team defense for this at-bat

export interface StatModifier {
  type: "stat_modifier";
  // Batter modifiers
  power?: number;
  contact?: number;
  glove?: number;
  speed?: number;
  // Pitcher modifiers (for Caster abilities used by pitchers)
  velocity?: number;
  control?: number;
  break?: number;
  // Special flags
  negateFatigue?: boolean; // For Time Warp ability
  // Duration
  duration: "at_bat" | "inning" | "game";
}

export interface OutcomeModifier {
  type: "outcome_modifier";
  // Probability adjustments (additive to chance %)
  homerunBonus?: number; // +X to HR threshold check (positive = more HRs)
  strikeoutBonus?: number; // +X to strikeout chance (positive = more Ks, negative = fewer Ks)
  walkBonus?: number; // +X to walk chance (positive = more walks)
  hitBonus?: number; // +X to net score / hit quality (positive = better contact)
}

export interface GuaranteedOutcome {
  type: "guaranteed_outcome";
  outcome: "single" | "walk" | "bunt_attempt" | "homerun" | "strikeout"; // Specific forced outcome
  successChance: number; // 0-100, for outcomes that can fail
  // Multi-outcome distribution (when present, replaces outcome+successChance)
  // Each entry has a result and a chance percentage; all chances should sum to 100
  outcomes?: Array<{
    result: "single" | "double" | "triple" | "homerun" | "walk" | "strikeout" | "out";
    chance: number;
  }>;
}

export interface DefensiveBoost {
  type: "defensive_boost";
  gloveBonus: number; // Boost to team's defensive glove rating
  duration: "at_bat";
}

export type AbilityEffect =
  | StatModifier
  | OutcomeModifier
  | GuaranteedOutcome
  | DefensiveBoost;

// ============================================
// ABILITY DEFINITION
// ============================================

export interface Ability {
  id: string; // Unique identifier (e.g., "precision_strike")
  name: string; // Display name
  description: string; // What it does
  flavorText?: string; // RPG flavor text

  // Resource cost
  spiritCost: number; // Spirit required to activate
  slotCost?: number; // Technique slot cost (default: 1, powerful techniques: 2-3)

  // Unlock requirements
  requiredClass: PlayerArchetype; // Which archetype can use this
  requiredLevel: number; // Minimum level to unlock
  prerequisiteAbilityId?: string; // Optional: must unlock X first

  // Choice system enhancements
  conflictsWith?: string[]; // Mutually exclusive techniques (can't have both)
  allowCrossArchetype?: boolean; // Can be learned by other archetypes (hybrid builds)
  isPassive?: boolean; // Always active (no spirit cost) vs active (requires spirit)

  // Categorization for build diversity
  path?: string; // e.g., "Power Path", "Finesse Path" - for UI grouping
  tags?: string[]; // e.g., ["offensive", "clutch", "defensive"] - for filtering

  // Effects
  effects: AbilityEffect[]; // What happens when activated

  // Upgrade system
  maxRank: number; // How many times can be upgraded
  currentRank: number; // Current upgrade level (1 = base)

  // Visual/UI
  iconEmoji?: string; // 8bit-style emoji icon

  // Synergy Enhancement - bonus effects when a team synergy is active
  synergyEnhancement?: {
    requiredSynergy: string; // Synergy ID (e.g., "murderers_row")
    requiredTier?: "bronze" | "silver" | "gold"; // Minimum tier (default: any active)
    bonusEffects: AbilityEffect[];
    enhancedDescription: string; // Description of the bonus
  };
}

// ============================================
// TECHNIQUE ALIASES (for clarity)
// ============================================

/**
 * Techniques are abilities that define player identity
 * Used interchangeably with Ability in the codebase
 */
export type Technique = Ability;

/**
 * Equipped techniques on a player
 * Used interchangeably with PlayerAbility in the codebase
 */
export type EquippedTechnique = PlayerAbility;

// ============================================
// PLAYER ABILITIES
// ============================================

export interface PlayerAbility {
  abilityId: string; // Reference to ability definition
  rank: number; // Current upgrade rank (1-based)
  timesUsed: number; // Career usage stats
}

// ============================================
// SPIRIT RESOURCE
// ============================================

export interface SpiritResource {
  current: number; // Current spirit available
  max: number; // Maximum spirit capacity
}

// Helper function to calculate max spirit based on level
export function calculateMaxSpirit(level: number): number {
  const BASE_SPIRIT = 50;
  const SPIRIT_PER_LEVEL = 5;
  return BASE_SPIRIT + (level - 1) * SPIRIT_PER_LEVEL;
}

// ============================================
// SKILL TREE
// ============================================

export interface SkillTreeNode {
  abilityId: string;
  position: { x: number; y: number }; // Grid position for UI
  connections: string[]; // IDs of prerequisite abilities
}

export interface SkillTree {
  className: PlayerClass;
  nodes: SkillTreeNode[];
}

// ============================================
// ACTIVE ABILITY CONTEXT
// ============================================

// Passed through match simulation to track active abilities
export interface ActiveAbilityContext {
  playerId: string;
  abilityId: string;
  effects: AbilityEffect[];
  activatedAt: "pre_at_bat"; // When it was activated
}

// ============================================
// ABILITY RECOMMENDATION
// ============================================

export interface AbilityRecommendation {
  abilityId: string;
  reason: string;
  priority: number; // 1-10, higher = more recommended
}

// ============================================
// RESPEC SYSTEM
// ============================================

export interface RespecCost {
  gold: number;
  level: number;
}

export function calculateRespecCost(level: number): number {
  const BASE_COST = 1000;
  return BASE_COST * level;
}

// ============================================
// CONSTANTS
// ============================================

export const ABILITY_CONSTANTS = {
  SKILL_POINTS_PER_LEVEL: 1,
  STARTING_SKILL_POINTS: 0,
  CLASS_SELECTION_LEVEL: 5,
  BASE_SPIRIT: 50,
  SPIRIT_PER_LEVEL: 5,
  RANK_MULTIPLIER: 1.25, // Effect scaling per rank (25% increase)
  RESPEC_BASE_COST: 1000,
} as const;
