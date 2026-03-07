/**
 * Bad Habits System - Player predictability and opponent adaptation
 *
 * When players rely too heavily on the same skill/approach, opponents adapt.
 * Bad habits create mechanical vulnerabilities that force strategic variety.
 *
 * Formation: 10+ consecutive uses of same skill without variation
 * Strength: 0–100 scale, increases with continued pattern, decreases with variety
 * Breaking: Requires 3+ successful ABs using different approach than habit
 * Consequence: Opponent adaptation, reduced success rate until broken
 */

/**
 * Bad Habit Types - Specific overreliance patterns
 */
export type BadHabitType =
  | "pull_happy"           // Overuse of power swings → infield shift applied
  | "telegraphed"          // Overuse of signature pitch → batter recognition rises
  | "overthinking"         // Mental skill used 5+ consecutive ABs → decision paralysis
  | "first_pitch_frenzy"   // Pitcher throws first-pitch strike >85% → batters sit
  | "chase_artist";        // Batter swings at 80%+ outside zone → fatigue accumulates

/**
 * Formation trigger types - How habits start
 */
export type HabitFormationType =
  | "skill_streak"         // 10+ consecutive same-skill uses
  | "approach_streak"      // 10+ consecutive same-approach uses
  | "overspecialization";  // Single mental skill used in 5+ consecutive ABs

/**
 * Bad Habit object - tracks formation, strength, and breaking
 */
export interface BadHabit {
  habitId: string;                     // Unique identifier
  habitType: BadHabitType;             // Type of habit formed
  formationType: HabitFormationType;    // How it was triggered
  strength: number;                    // 0–100, increases per continued use
  isActive: boolean;                   // true if strength > 50
  consecutiveUses: number;             // Uses of the pattern (resets on break)
  consecutiveNonUses: number;          // Uses of different approach (for breaking)
  formedAtGame: number;                // Game number when formed
  brokenAt?: number;                   // Game number if broken
  opponentKnowledge: number;           // 0–3, how many opponents know (scouts/coaches)
  sourceSkillId?: string;              // Mental skill ID if triggered by overuse
  sourceApproach?: string;             // Approach if triggered by approach streak
}

/**
 * Habit formation context - passed to detection function
 */
export interface HabitDetectionContext {
  gameNumber: number;
  playerSkillUses: Record<string, number>;    // skillId → consecutive use count
  playerApproachUses: Record<string, number>; // approach → consecutive use count
  lastThreeApproaches: string[];              // Last 3 AB approaches
  lastThreeMentalSkills: string[];            // Last 3 mental skills used
  totalABsInGame: number;
}

/**
 * Habit effect summary - how habit impacts player performance
 */
export interface HabitEffect {
  habitType: BadHabitType;
  strength: number;
  contactPenalty: number;              // −X% to hit rate vs shift (pull_happy)
  opponentContactBonus: number;        // +X% opponent contact recognition
  decisionAccuracyPenalty: number;    // −X% mental skill accuracy
  fatigueRate: number;                 // Fatigue multiplier (1.0 = baseline, 1.2 = 20% more)
  shiftProbability: number;            // Likelihood infield shift applied
  firstPitchBatterAdaptation: number; // Batter adjusts to first-pitch throws
}

/**
 * Per-player AB usage log — tracks streaks for habit detection
 * Stored on Player, reset at start of each season
 */
export interface HabitUsageLog {
  // Per-skill consecutive use tracking (skillId → count)
  skillStreaks: Record<string, number>;
  // Per-approach consecutive use tracking (approach → count)
  approachStreaks: Record<string, number>;
  // Last N approaches for context (max 10, rolling)
  recentApproaches: string[];
  // Last N skills used (max 10, rolling)
  recentSkills: string[];
}

/**
 * Player habit extension - added to Player type
 */
export interface PlayerHabitData {
  badHabits: BadHabit[];
  habitHistory: {
    broken: BadHabit[];                // Habits that were broken
    knownByOpponents: string[];        // Opponent IDs who know about habits (JSON-safe)
  };
}

/**
 * Get default effect values for a habit type and strength
 */
export function getHabitEffect(
  habitType: BadHabitType,
  strength: number
): HabitEffect {
  // Scale effects 0–100 based on strength
  const scale = strength / 100;

  const baseEffects: Record<BadHabitType, Omit<HabitEffect, "habitType" | "strength">> = {
    pull_happy: {
      contactPenalty: 15 * scale,
      opponentContactBonus: 0,
      decisionAccuracyPenalty: 0,
      fatigueRate: 1,
      shiftProbability: 0.75 * scale,
      firstPitchBatterAdaptation: 0,
    },
    telegraphed: {
      contactPenalty: 0,
      opponentContactBonus: 10 * scale,
      decisionAccuracyPenalty: 0,
      fatigueRate: 1,
      shiftProbability: 0,
      firstPitchBatterAdaptation: 0,
    },
    overthinking: {
      contactPenalty: 0,
      opponentContactBonus: 0,
      decisionAccuracyPenalty: 10 * scale,
      fatigueRate: 1,
      shiftProbability: 0,
      firstPitchBatterAdaptation: 0,
    },
    first_pitch_frenzy: {
      contactPenalty: 0,
      opponentContactBonus: 0,
      decisionAccuracyPenalty: 0,
      fatigueRate: 1,
      shiftProbability: 0,
      firstPitchBatterAdaptation: 0.8 * scale,
    },
    chase_artist: {
      contactPenalty: 8 * scale,
      opponentContactBonus: 0,
      decisionAccuracyPenalty: 0,
      fatigueRate: 1 + (0.2 * scale), // Multiplier: 1.0 (no effect) → 1.2 (full strength)
      shiftProbability: 0,
      firstPitchBatterAdaptation: 0,
    },
  };

  return {
    habitType,
    strength,
    ...baseEffects[habitType],
  };
}

/**
 * Habit strength thresholds
 */
export const HABIT_THRESHOLDS = {
  FORMATION_STREAK_LENGTH: 10,      // Uses needed to form
  BREAKING_VARIED_ABS: 3,           // Different approaches to break
  ACTIVATION_STRENGTH: 50,           // Strength threshold for isActive
  MAX_STRENGTH: 100,
  MIN_STRENGTH: 0,
  STRENGTH_INCREASE_PER_USE: 5,     // Points added per continued use
  STRENGTH_DECREASE_PER_VARIED_AB: 10, // Points subtracted per non-pattern AB
};
