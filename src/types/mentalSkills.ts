/**
 * Mental Skills System — Phase 1 Types
 *
 * Mental skills are volatile, identity-driven abilities that:
 * - Peak late (age 33-35) unlike physical skills (26-27)
 * - Decay without use (-decayRate confidence/game)
 * - Reactivate 2x faster than learning fresh
 * - Map to existing PlayerTrait values (no new traits needed)
 *
 * See SKILLS_SYSTEM_FINAL.md for full design rationale.
 */

// ─── Enums & Identifiers ────────────────────────────────────────────────────

export type MentalSkillType =
  | "ice_veins"          // Ice trait  — clutch nerves of steel; neutralizes pressure
  | "pitch_recognition"  // Eye trait  — reads pitch type before release
  | "clutch_composure"   // Heart trait — performance lifts in high-leverage moments
  | "veteran_poise"      // Wile trait  — consistency from experience; unlocks at age 31+
  | "game_reading";      // Brain trait — opponent pattern recognition; adapts mid-game

export type MentalSkillRank = 0 | 1 | 2 | 3 | 4 | 5;

/** Maps PlayerTrait to the mental skill it unlocks */
export const TRAIT_TO_MENTAL_SKILL: Readonly<Partial<Record<string, MentalSkillType>>> = {
  Ice:   "ice_veins",
  Eye:   "pitch_recognition",
  Heart: "clutch_composure",
  Wile:  "veteran_poise",
  Brain: "game_reading",
} as const;

// ─── Physical Potential ─────────────────────────────────────────────────────

/**
 * Physical potential tiers (40 | 60 | 80 | 100).
 * These act as hard ceilings on physical skill ranks.
 * Generated once at player creation, immutable thereafter.
 */
export type PhysicalPotentialTier = 40 | 60 | 80 | 100;

export interface PhysicalPotential {
  strength:    PhysicalPotentialTier; // Caps power-based physical skills
  agility:     PhysicalPotentialTier; // Caps speed/contact-based skills
  armStrength: PhysicalPotentialTier; // Caps pitcher velocity ceiling
  breakMastery: PhysicalPotentialTier; // Caps pitcher break ceiling
}

// ─── XP & Confidence ────────────────────────────────────────────────────────

/** XP required to advance from rank N → N+1 */
export const MENTAL_SKILL_RANK_XP: Record<MentalSkillRank, number> = {
  0: 100,
  1: 250,
  2: 500,
  3: 1000,
  4: 2000,
  5: 0, // maxed
} as const;

export const DEFAULT_DECAY_RATE = 5;          // % confidence lost per game without trigger
export const CONFIDENCE_ACTIVE_THRESHOLD = 20; // isActive = false below this
export const REACTIVATION_XP_MULTIPLIER = 2;   // relearning a lapsed skill earns 2x XP

// ─── Core Mental Skill Interface ─────────────────────────────────────────────

export interface MentalSkill {
  skillId:           MentalSkillType;
  rank:              MentalSkillRank;
  xp:                number;  // XP toward next rank (resets on rank-up)
  xpToNextRank:      number;  // Cached from MENTAL_SKILL_RANK_XP[rank]
  confidence:        number;  // 0–100; decays without use
  lastTriggeredGame: number;  // Game number of last trigger (for decay calc)
  isActive:          boolean; // false if confidence < CONFIDENCE_ACTIVE_THRESHOLD
  decayRate:         number;  // % per game — defaults to DEFAULT_DECAY_RATE
  wasLapsed:         boolean; // true if confidence hit 0 then recovered (faster reactivation)
  discoveredAt?:     number;  // Game number when first discovered
}

// ─── Discovery Conditions ───────────────────────────────────────────────────

/**
 * Conditions under which a mental skill can be discovered.
 * Evaluated against game context in the match engine.
 */
export interface MentalSkillDiscoveryCondition {
  skillId:     MentalSkillType;
  traitRequired: string;  // Must have this PlayerTrait
  minAge?:     number;    // Some skills require age threshold (e.g., veteran_poise: 31+)
  leverageRequired: boolean; // Must be in a high-leverage at-bat
}

export const MENTAL_SKILL_DISCOVERY_CONDITIONS: MentalSkillDiscoveryCondition[] = [
  {
    skillId:          "ice_veins",
    traitRequired:    "Ice",
    leverageRequired: true,
  },
  {
    skillId:          "pitch_recognition",
    traitRequired:    "Eye",
    leverageRequired: false,
  },
  {
    skillId:          "clutch_composure",
    traitRequired:    "Heart",
    leverageRequired: true,
  },
  {
    skillId:          "veteran_poise",
    traitRequired:    "Wile",
    minAge:           31,
    leverageRequired: false,
  },
  {
    skillId:          "game_reading",
    traitRequired:    "Brain",
    leverageRequired: false,
  },
];

// ─── In-Game Effect Modifiers ────────────────────────────────────────────────

/**
 * How much each rank of a mental skill modifies in-game stats.
 * Applied as additive bonuses to effective contact/power/control etc.
 * Rank 0 = no effect, Rank 5 = maximum bonus.
 */
export const MENTAL_SKILL_RANK_BONUS: Record<MentalSkillRank, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 9,
  5: 13,
} as const;
