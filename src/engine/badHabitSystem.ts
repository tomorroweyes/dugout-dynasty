/**
 * Bad Habit System — Track overreliance patterns and apply opponent adaptation
 *
 * Works alongside breakthroughSystem.ts — active bad habits reduce breakthrough probability
 * by -15% and block signature skill generation at Rank 4→5.
 *
 * Key mechanics:
 *   Formation: 10+ consecutive same-skill uses → habit forms at strength 0
 *   Growth:    Each continued pattern use: +5 strength (cap 100)
 *   Active:    Strength > 50 triggers mechanical effect
 *   Breaking:  3 varied approach ABs → strength reset to 0, habit marked broken
 *   Scouting:  Habit knowledge spreads to opponents at strength 75+
 */

import type { Player } from "@/types/game";
import type {
  BadHabit,
  BadHabitType,
  HabitFormationType,
  HabitUsageLog,
} from "@/types/badHabits";
import {
  getHabitEffect,
  HABIT_THRESHOLDS,
} from "@/types/badHabits";
import {
  BAD_HABIT_COSTS_TEXTS,
  BAD_HABIT_BREAK_TEXTS,
  BAD_HABIT_SCOUTED_TEXTS,
} from "./narrative/situationalPools";
import { randomChoice } from "./textPools";

// ---------------------------------------------------------------------------
// Public event types
// ---------------------------------------------------------------------------

export type HabitEventType =
  | "formed"
  | "strengthened"
  | "weakened"
  | "activated"   // Crossed the 50-strength threshold
  | "scouted"     // Opponent knowledge escalated
  | "broken";

export interface HabitEvent {
  type: HabitEventType;
  habitId: string;
  habitType: BadHabitType;
  previousStrength: number;
  newStrength: number;
  narrative?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a deterministic-ish unique ID */
function makeHabitId(playerId: string, habitType: BadHabitType, gameNumber: number): string {
  return `habit-${playerId}-${habitType}-g${gameNumber}`;
}

/** Get or create the habit usage log on a player */
export function getOrCreateUsageLog(player: Player): HabitUsageLog {
  if (!player.habitUsageLog) {
    player.habitUsageLog = {
      skillStreaks: {},
      approachStreaks: {},
      recentApproaches: [],
      recentSkills: [],
    };
  }
  return player.habitUsageLog;
}

/** Get all bad habits (active and broken) from a player */
export function getPlayerHabits(player: Player): BadHabit[] {
  return player.badHabits ?? [];
}

/** Get only active bad habits (strength > 50, not broken) */
export function getActiveHabits(player: Player): BadHabit[] {
  return (player.badHabits ?? []).filter(
    (h) => h.isActive && h.brokenAt === undefined
  );
}

/**
 * Check if player has at least one active bad habit.
 * Used by breakthroughSystem.ts for the -15% penalty and signature skill block.
 */
export function hasActiveBadHabit(player: Player): boolean {
  return getActiveHabits(player).length > 0;
}

/**
 * Find existing un-broken habit of a given type
 */
function findExistingHabit(player: Player, habitType: BadHabitType): BadHabit | undefined {
  return (player.badHabits ?? []).find(
    (h) => h.habitType === habitType && h.brokenAt === undefined
  );
}

// ---------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------

/**
 * Create a new BadHabit and add it to the player.
 * Called internally when a streak crosses the formation threshold.
 */
export function formBadHabit(
  player: Player,
  habitType: BadHabitType,
  formationType: HabitFormationType,
  gameNumber: number,
  sourceSkillId?: string,
  sourceApproach?: string
): BadHabit {
  if (!player.badHabits) {
    player.badHabits = [];
  }

  const habit: BadHabit = {
    habitId: makeHabitId(player.id, habitType, gameNumber),
    habitType,
    formationType,
    strength: 0,
    isActive: false,
    consecutiveUses: HABIT_THRESHOLDS.FORMATION_STREAK_LENGTH,
    consecutiveNonUses: 0,
    formedAtGame: gameNumber,
    opponentKnowledge: 0,
    sourceSkillId,
    sourceApproach,
  };

  player.badHabits.push(habit);
  return habit;
}

// ---------------------------------------------------------------------------
// Strength updates
// ---------------------------------------------------------------------------

/**
 * Record a pattern use (same skill/approach as habit).
 * Increases habit strength by STRENGTH_INCREASE_PER_USE.
 * Returns HabitEvent describing the change.
 */
export function reinforceHabit(
  habit: BadHabit,
  player: Player,
  gameNumber: number
): HabitEvent {
  const prev = habit.strength;
  habit.consecutiveUses += 1;
  habit.consecutiveNonUses = 0;

  const newStrength = Math.min(
    HABIT_THRESHOLDS.MAX_STRENGTH,
    habit.strength + HABIT_THRESHOLDS.STRENGTH_INCREASE_PER_USE
  );
  habit.strength = newStrength;

  const justActivated = prev <= HABIT_THRESHOLDS.ACTIVATION_STRENGTH && newStrength > HABIT_THRESHOLDS.ACTIVATION_STRENGTH;
  habit.isActive = newStrength > HABIT_THRESHOLDS.ACTIVATION_STRENGTH;

  // Escalate opponent knowledge at 75+
  let scouted = false;
  if (newStrength >= 75 && habit.opponentKnowledge < 3) {
    // One escalation per game max (coarse guard via gameNumber check)
    const shouldEscalate = habit.formedAtGame !== gameNumber;
    if (shouldEscalate) {
      habit.opponentKnowledge = Math.min(3, habit.opponentKnowledge + 1);
      scouted = true;
    }
  }

  if (justActivated) {
    return { type: "activated", habitId: habit.habitId, habitType: habit.habitType, previousStrength: prev, newStrength };
  }
  if (scouted) {
    const narrative = randomChoice(BAD_HABIT_SCOUTED_TEXTS).replace(/{playerName}/g, player.name);
    return { type: "scouted", habitId: habit.habitId, habitType: habit.habitType, previousStrength: prev, newStrength, narrative };
  }
  return { type: "strengthened", habitId: habit.habitId, habitType: habit.habitType, previousStrength: prev, newStrength };
}

/**
 * Record a varied use (different skill/approach than habit).
 * Decreases habit strength by STRENGTH_DECREASE_PER_VARIED_AB.
 * Returns HabitEvent, or null if habit was broken.
 */
export function weakenHabit(
  habit: BadHabit,
  player: Player,
  gameNumber: number
): HabitEvent {
  const prev = habit.strength;
  habit.consecutiveNonUses += 1;
  habit.consecutiveUses = Math.max(0, habit.consecutiveUses - 1);

  const newStrength = Math.max(
    HABIT_THRESHOLDS.MIN_STRENGTH,
    habit.strength - HABIT_THRESHOLDS.STRENGTH_DECREASE_PER_VARIED_AB
  );
  habit.strength = newStrength;
  habit.isActive = newStrength > HABIT_THRESHOLDS.ACTIVATION_STRENGTH;

  // Breaking condition: 3+ consecutive non-habit ABs
  if (habit.consecutiveNonUses >= HABIT_THRESHOLDS.BREAKING_VARIED_ABS) {
    return breakHabit(habit, player, gameNumber);
  }

  return { type: "weakened", habitId: habit.habitId, habitType: habit.habitType, previousStrength: prev, newStrength };
}

/**
 * Mark a habit as broken — strength reset to 0, brokenAt recorded.
 */
export function breakHabit(
  habit: BadHabit,
  player: Player,
  gameNumber: number
): HabitEvent {
  const prev = habit.strength;
  habit.strength = 0;
  habit.isActive = false;
  habit.brokenAt = gameNumber;
  habit.consecutiveNonUses = 0;
  habit.consecutiveUses = 0;
  habit.opponentKnowledge = 0; // Scouting intel lost

  const narrative = randomChoice(BAD_HABIT_BREAK_TEXTS).replace(/{playerName}/g, player.name);
  return { type: "broken", habitId: habit.habitId, habitType: habit.habitType, previousStrength: prev, newStrength: 0, narrative };
}

// ---------------------------------------------------------------------------
// Skill usage tracking
// ---------------------------------------------------------------------------

/**
 * Record a mental skill use and detect/update habits.
 *
 * @param player      The player who used the skill
 * @param skillId     The skill that was used
 * @param gameNumber  Current game number
 * @returns           Array of habit events that occurred (may be empty)
 */
export function trackSkillUsage(
  player: Player,
  skillId: string,
  gameNumber: number
): HabitEvent[] {
  const log = getOrCreateUsageLog(player);
  const events: HabitEvent[] = [];

  // Update recent skills (rolling window of 10)
  log.recentSkills = [...log.recentSkills.slice(-9), skillId];

  // Update consecutive streak for this skill
  // Reset all OTHER skill streaks to 0
  for (const id of Object.keys(log.skillStreaks)) {
    if (id !== skillId) {
      log.skillStreaks[id] = 0;
    }
  }
  log.skillStreaks[skillId] = (log.skillStreaks[skillId] ?? 0) + 1;

  const streak = log.skillStreaks[skillId];

  // Map skillId to habit type — overthinking forms from any mental skill overuse
  const existingHabit = findExistingHabit(player, "overthinking");

  if (existingHabit) {
    // Reinforce if same streak is ongoing
    const event = reinforceHabit(existingHabit, player, gameNumber);
    events.push(event);
    return events;
  }

  // Form habit at threshold
  if (streak >= HABIT_THRESHOLDS.FORMATION_STREAK_LENGTH) {
    const habit = formBadHabit(
      player,
      "overthinking",
      "skill_streak",
      gameNumber,
      skillId
    );
    events.push({
      type: "formed",
      habitId: habit.habitId,
      habitType: habit.habitType,
      previousStrength: 0,
      newStrength: 0,
    });
  }

  return events;
}

/**
 * Record an approach use (batting/pitching style choice) and detect/update habits.
 *
 * @param player      The player making the approach
 * @param approach    The approach key (e.g. "power", "contact", "aggressive")
 * @param habitType   The habit that this approach can form/break
 * @param gameNumber  Current game number
 * @returns           Array of habit events
 */
export function trackApproachUsage(
  player: Player,
  approach: string,
  habitType: BadHabitType,
  gameNumber: number
): HabitEvent[] {
  const log = getOrCreateUsageLog(player);
  const events: HabitEvent[] = [];

  // Update recent approaches (rolling window of 10)
  log.recentApproaches = [...log.recentApproaches.slice(-9), approach];

  // Determine if this approach is the "pattern approach" for this habit type
  const patternApproach = HABIT_PATTERN_APPROACHES[habitType];

  if (patternApproach === undefined) {
    // Habit type not approach-driven (e.g. overthinking is skill-driven)
    return events;
  }

  const isPatternUse = approach === patternApproach;
  const existingHabit = findExistingHabit(player, habitType);

  if (existingHabit) {
    if (isPatternUse) {
      events.push(reinforceHabit(existingHabit, player, gameNumber));
    } else {
      events.push(weakenHabit(existingHabit, player, gameNumber));
    }
    return events;
  }

  if (!isPatternUse) {
    // Not matching pattern, no existing habit — nothing to do
    return events;
  }

  // Pattern use — track the streak
  for (const id of Object.keys(log.approachStreaks)) {
    if (id !== approach) {
      log.approachStreaks[id] = 0;
    }
  }
  log.approachStreaks[approach] = (log.approachStreaks[approach] ?? 0) + 1;

  const streak = log.approachStreaks[approach];

  if (streak >= HABIT_THRESHOLDS.FORMATION_STREAK_LENGTH) {
    const habit = formBadHabit(
      player,
      habitType,
      "approach_streak",
      gameNumber,
      undefined,
      approach
    );
    events.push({
      type: "formed",
      habitId: habit.habitId,
      habitType: habit.habitType,
      previousStrength: 0,
      newStrength: 0,
    });
  }

  return events;
}

/**
 * Which approach key triggers each habit type (undefined = not approach-driven)
 */
const HABIT_PATTERN_APPROACHES: Partial<Record<BadHabitType, string>> = {
  pull_happy: "power",
  telegraphed: "signature",
  first_pitch_frenzy: "first_pitch",
  chase_artist: "aggressive",
  // overthinking is tracked by trackSkillUsage, not approach
};

// ---------------------------------------------------------------------------
// Varied approach handling (weaken ALL active habits not matching the approach)
// ---------------------------------------------------------------------------

/**
 * Record a "varied" approach that doesn't match any active habit pattern.
 * Weakens all active habits by one varied-AB step.
 * Call this when the player uses an approach that breaks any pattern.
 *
 * @param player     The player who varied their approach
 * @param gameNumber Current game number
 * @returns          Array of habit events
 */
export function recordVariedApproach(
  player: Player,
  gameNumber: number
): HabitEvent[] {
  const events: HabitEvent[] = [];
  const active = getActiveHabits(player);

  for (const habit of active) {
    events.push(weakenHabit(habit, player, gameNumber));
  }

  return events;
}

// ---------------------------------------------------------------------------
// Effect application
// ---------------------------------------------------------------------------

/**
 * Aggregate all active habit effects into a single combined penalty.
 * Used by match engine to apply handicaps without knowing individual habits.
 */
export interface CombinedHabitEffect {
  totalContactPenalty: number;        // Sum of contact penalties
  totalOpponentContactBonus: number;  // Sum of opponent bonuses
  totalDecisionAccuracyPenalty: number;
  maxFatigueRate: number;             // Highest fatigue multiplier wins
  hasShift: boolean;                  // True if any habit triggers shift
  maxShiftProbability: number;
  maxFirstPitchAdaptation: number;
}

export function getCombinedHabitEffect(player: Player): CombinedHabitEffect {
  const combined: CombinedHabitEffect = {
    totalContactPenalty: 0,
    totalOpponentContactBonus: 0,
    totalDecisionAccuracyPenalty: 0,
    maxFatigueRate: 1,
    hasShift: false,
    maxShiftProbability: 0,
    maxFirstPitchAdaptation: 0,
  };

  for (const habit of getActiveHabits(player)) {
    const effect = getHabitEffect(habit.habitType, habit.strength);
    combined.totalContactPenalty += effect.contactPenalty;
    combined.totalOpponentContactBonus += effect.opponentContactBonus;
    combined.totalDecisionAccuracyPenalty += effect.decisionAccuracyPenalty;
    combined.maxFatigueRate = Math.max(combined.maxFatigueRate, effect.fatigueRate);
    combined.maxShiftProbability = Math.max(combined.maxShiftProbability, effect.shiftProbability);
    combined.maxFirstPitchAdaptation = Math.max(combined.maxFirstPitchAdaptation, effect.firstPitchBatterAdaptation);
  }

  combined.hasShift = combined.maxShiftProbability > 0;
  return combined;
}

// ---------------------------------------------------------------------------
// Narrative generation for habit effects triggering
// ---------------------------------------------------------------------------

/**
 * Generate a narrative for when an active bad habit costs the player a play.
 * Called by match engine when an active habit's penalty was the deciding factor.
 */
export function generateHabitCostNarrative(player: Player): string {
  const template = randomChoice(BAD_HABIT_COSTS_TEXTS);
  return template.replace(/{playerName}/g, player.name);
}

// ---------------------------------------------------------------------------
// Utility: reset usage log (start of season / after reinvention arc)
// ---------------------------------------------------------------------------

/**
 * Reset the usage log. Called at season start or after reinvention arc.
 * Does NOT clear habits — only the streak counters.
 */
export function resetUsageLog(player: Player): void {
  player.habitUsageLog = {
    skillStreaks: {},
    approachStreaks: {},
    recentApproaches: [],
    recentSkills: [],
  };
}

/**
 * Reset all habit knowledge after reinvention arc.
 * Marks all active habits as broken and resets opponent knowledge.
 */
export function applyReinventionReset(player: Player, gameNumber: number): HabitEvent[] {
  const events: HabitEvent[] = [];
  const active = getActiveHabits(player);

  for (const habit of active) {
    events.push(breakHabit(habit, player, gameNumber));
  }

  resetUsageLog(player);
  return events;
}
