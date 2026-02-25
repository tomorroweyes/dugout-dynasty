/**
 * Synergy Configuration
 *
 * Spirit Island-inspired element threshold system.
 * Lineup trait combinations unlock synergies (team-wide passive bonuses).
 *
 * Traits are permanent personality tags on players (1-2 per player).
 * Synergies are derived state — computed at match start from lineup traits.
 */

import type { PlayerTrait } from "@/types/game";
import type { PlayerArchetype } from "@/types/ability";
import type { AbilityEffect } from "@/types/ability";

// ============================================
// TRAIT CONSTANTS
// ============================================

export const ALL_TRAITS: PlayerTrait[] = [
  "Muscle", "Grit", "Flash", "Eye", "Glue",
  "Fire", "Ice", "Wile", "Heart", "Brain",
];

export const TRAIT_EMOJI: Record<PlayerTrait, string> = {
  Muscle: "💪",
  Grit: "🔩",
  Flash: "⚡",
  Eye: "👁️",
  Glue: "🧤",
  Fire: "🔥",
  Ice: "❄️",
  Wile: "🌀",
  Heart: "❤️",
  Brain: "🧠",
};

export const TRAIT_IDENTITY: Record<PlayerTrait, string> = {
  Muscle: "Raw physical power",
  Grit: "Tough, grinds out at-bats",
  Flash: "Explosive speed and flair",
  Eye: "Plate discipline, pitch recognition",
  Glue: "Defensive anchor",
  Fire: "Intimidation and intensity",
  Ice: "Calm under pressure, precision",
  Wile: "Deception and unpredictability",
  Heart: "Team leader, clutch performer",
  Brain: "Strategic IQ, adaptability",
};

/** Chance a player gets a second trait (50%) */
export const SECONDARY_TRAIT_CHANCE = 0.5;

// ============================================
// TRAIT ASSIGNMENT WEIGHTS BY ARCHETYPE
// ============================================

/**
 * Primary trait weights by archetype.
 * Higher weight = more likely to be assigned as primary trait.
 * Weights are relative (don't need to sum to 1).
 */
export const ARCHETYPE_TRAIT_WEIGHTS: Record<PlayerArchetype, Partial<Record<PlayerTrait, number>>> = {
  Slugger: {
    Muscle: 4, Grit: 2, Fire: 2, Heart: 1, Eye: 1,
  },
  "Contact Hitter": {
    Eye: 4, Grit: 2, Brain: 2, Heart: 1, Ice: 1,
  },
  "Speed Demon": {
    Flash: 4, Grit: 2, Heart: 2, Wile: 1, Fire: 1,
  },
  Flamethrower: {
    Fire: 4, Muscle: 2, Grit: 2, Heart: 1, Ice: 1,
  },
  Painter: {
    Ice: 4, Brain: 2, Eye: 2, Glue: 1, Heart: 1,
  },
  Trickster: {
    Wile: 4, Brain: 2, Ice: 2, Flash: 1, Fire: 1,
  },
};

/**
 * Fallback weights for players without an archetype yet.
 * Role-based: batters lean toward offensive traits, pitchers lean toward pitching traits.
 */
export const ROLE_TRAIT_WEIGHTS: Record<"Batter" | "Pitcher", Partial<Record<PlayerTrait, number>>> = {
  Batter: {
    Muscle: 2, Grit: 2, Flash: 2, Eye: 2, Glue: 1,
    Fire: 1, Heart: 1, Brain: 1,
  },
  Pitcher: {
    Fire: 2, Ice: 2, Wile: 2, Brain: 2, Grit: 1,
    Glue: 1, Heart: 1, Muscle: 1,
  },
};

// ============================================
// SYNERGY DEFINITIONS
// ============================================

export type SynergyTier = "bronze" | "silver" | "gold";

export interface SingleTraitSynergyDef {
  id: string;
  name: string;
  trait: PlayerTrait;
  type: "single";
  tiers: {
    bronze: { threshold: 2; effects: AbilityEffect[]; description: string };
    silver: { threshold: 3; effects: AbilityEffect[]; description: string };
    gold: { threshold: 4; effects: AbilityEffect[]; description: string };
  };
  emoji: string;
}

export interface ComboSynergyDef {
  id: string;
  name: string;
  requirements: { trait: PlayerTrait; count: number }[];
  type: "combo";
  effects: AbilityEffect[];
  description: string;
  emoji: string;
}

export type SynergyDef = SingleTraitSynergyDef | ComboSynergyDef;

// ── Single-Trait Synergies (6, tiered) ──

export const SINGLE_TRAIT_SYNERGIES: SingleTraitSynergyDef[] = [
  {
    id: "murderers_row",
    name: "Murderers' Row",
    trait: "Muscle",
    type: "single",
    emoji: "💪",
    tiers: {
      bronze: {
        threshold: 2,
        effects: [{ type: "stat_modifier", power: 3, duration: "game" }],
        description: "+3 PWR all batters",
      },
      silver: {
        threshold: 3,
        effects: [{ type: "stat_modifier", power: 5, duration: "game" }],
        description: "+5 PWR all batters",
      },
      gold: {
        threshold: 4,
        effects: [{ type: "stat_modifier", power: 8, duration: "game" }],
        description: "+8 PWR all batters",
      },
    },
  },
  {
    id: "ironclad",
    name: "Ironclad",
    trait: "Grit",
    type: "single",
    emoji: "🔩",
    tiers: {
      bronze: {
        threshold: 2,
        effects: [{ type: "outcome_modifier", strikeoutBonus: -2 }],
        description: "-2% K chance",
      },
      silver: {
        threshold: 3,
        effects: [{ type: "outcome_modifier", strikeoutBonus: -4 }],
        description: "-4% K chance",
      },
      gold: {
        threshold: 4,
        effects: [
          { type: "outcome_modifier", strikeoutBonus: -6 },
          { type: "stat_modifier", contact: 2, duration: "game" },
        ],
        description: "-6% K chance, +2 CON",
      },
    },
  },
  {
    id: "greased_lightning",
    name: "Greased Lightning",
    trait: "Flash",
    type: "single",
    emoji: "⚡",
    tiers: {
      bronze: {
        threshold: 2,
        effects: [{ type: "stat_modifier", speed: 3, duration: "game" }],
        description: "+3 SPD",
      },
      silver: {
        threshold: 3,
        effects: [{ type: "stat_modifier", speed: 5, duration: "game" }],
        description: "+5 SPD",
      },
      gold: {
        threshold: 4,
        effects: [
          { type: "stat_modifier", speed: 8, duration: "game" },
          { type: "outcome_modifier", walkBonus: 3 },
        ],
        description: "+8 SPD, +3% walk",
      },
    },
  },
  {
    id: "eagle_eye",
    name: "Eagle Eye",
    trait: "Eye",
    type: "single",
    emoji: "👁️",
    tiers: {
      bronze: {
        threshold: 2,
        effects: [{ type: "outcome_modifier", walkBonus: 2 }],
        description: "+2% walk",
      },
      silver: {
        threshold: 3,
        effects: [
          { type: "outcome_modifier", walkBonus: 4 },
          { type: "stat_modifier", contact: 2, duration: "game" },
        ],
        description: "+4% walk, +2 CON",
      },
      gold: {
        threshold: 4,
        effects: [
          { type: "outcome_modifier", walkBonus: 6 },
          { type: "stat_modifier", contact: 4, duration: "game" },
        ],
        description: "+6% walk, +4 CON",
      },
    },
  },
  {
    id: "iron_curtain",
    name: "Iron Curtain",
    trait: "Glue",
    type: "single",
    emoji: "🧤",
    tiers: {
      bronze: {
        threshold: 2,
        effects: [{ type: "stat_modifier", glove: 3, duration: "game" }],
        description: "+3 GLV",
      },
      silver: {
        threshold: 3,
        effects: [{ type: "stat_modifier", glove: 5, duration: "game" }],
        description: "+5 GLV",
      },
      gold: {
        threshold: 4,
        effects: [
          { type: "stat_modifier", glove: 8, duration: "game" },
          { type: "outcome_modifier", homerunBonus: -3 },
        ],
        description: "+8 GLV, -3% HR allowed",
      },
    },
  },
  {
    id: "furnace",
    name: "Furnace",
    trait: "Fire",
    type: "single",
    emoji: "🔥",
    tiers: {
      bronze: {
        threshold: 2,
        effects: [{ type: "stat_modifier", velocity: 3, duration: "game" }],
        description: "+3 VEL all pitchers",
      },
      silver: {
        threshold: 3,
        effects: [{ type: "stat_modifier", velocity: 5, duration: "game" }],
        description: "+5 VEL all pitchers",
      },
      gold: {
        threshold: 4,
        effects: [
          { type: "stat_modifier", velocity: 8, duration: "game" },
          { type: "outcome_modifier", strikeoutBonus: 2 },
        ],
        description: "+8 VEL, +2% K",
      },
    },
  },
];

// ── Combo Synergies (4, single threshold) ──

export const COMBO_SYNERGIES: ComboSynergyDef[] = [
  {
    id: "mastermind",
    name: "Mastermind",
    requirements: [
      { trait: "Brain", count: 2 },
      { trait: "Ice", count: 1 },
    ],
    type: "combo",
    emoji: "🧠",
    effects: [
      { type: "stat_modifier", control: 3, duration: "game" },
      { type: "stat_modifier", contact: 3, duration: "game" },
    ],
    description: "+3 CTL (pitchers), +3 CON (batters)",
  },
  {
    id: "wildcard",
    name: "Wildcard",
    requirements: [
      { trait: "Wile", count: 2 },
      { trait: "Flash", count: 1 },
    ],
    type: "combo",
    emoji: "🃏",
    effects: [
      { type: "outcome_modifier", walkBonus: 3 },
      { type: "stat_modifier", break: 3, duration: "game" },
      { type: "outcome_modifier", hitBonus: 2 },
    ],
    description: "+3% walk, +3 BRK, +2 hit quality",
  },
  {
    id: "clubhouse_leader",
    name: "Clubhouse Leader",
    requirements: [
      { trait: "Heart", count: 2 },
      { trait: "Grit", count: 1 },
    ],
    type: "combo",
    emoji: "❤️",
    effects: [
      { type: "stat_modifier", power: 3, contact: 3, glove: 3, speed: 3, duration: "game" },
    ],
    description: "+3 to ALL batter stats",
  },
  {
    id: "mind_games",
    name: "Mind Games",
    requirements: [
      { trait: "Brain", count: 1 },
      { trait: "Fire", count: 1 },
      { trait: "Wile", count: 1 },
    ],
    type: "combo",
    emoji: "🎭",
    effects: [
      { type: "outcome_modifier", strikeoutBonus: 3 },
      { type: "outcome_modifier", strikeoutBonus: -2 },
    ],
    description: "+3% K (pitchers), -2% K (batters)",
  },
];

/** All synergy definitions combined */
export const ALL_SYNERGIES: SynergyDef[] = [
  ...SINGLE_TRAIT_SYNERGIES,
  ...COMBO_SYNERGIES,
];
