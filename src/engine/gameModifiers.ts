import { GAME_CONSTANTS } from "./constants";

/**
 * Modifier system for applying various penalties/bonuses to player stats.
 * This provides a clean extension point for adding new modifiers (weather, morale, injuries, etc.)
 */

export type ModifierType = "fatigue" | "momentum" | "weather" | "injury";

export interface Modifier {
  type: ModifierType;
  apply: (value: number, context: ModifierContext) => number;
}

export interface ModifierContext {
  inningsPitched?: number;
  momentum?: number;
  weather?: string;
  injuryLevel?: number;
}

/**
 * Pitcher fatigue modifier - reduces effectiveness based on innings pitched in current game
 */
export const pitcherFatigueModifier: Modifier = {
  type: "fatigue",
  apply: (value: number, context: ModifierContext): number => {
    if (context.inningsPitched === undefined) return value;

    const fatiguePenalty =
      1 - context.inningsPitched * GAME_CONSTANTS.PITCHER_FATIGUE.EFFECTIVENESS_LOSS_PER_INNING;
    const cappedPenalty = Math.max(
      GAME_CONSTANTS.PITCHER_FATIGUE.MINIMUM_EFFECTIVENESS,
      fatiguePenalty
    );

    return value * cappedPenalty;
  },
};

/**
 * Example: Momentum modifier (for future use)
 * Could track team momentum based on recent performance
 */
export const momentumModifier: Modifier = {
  type: "momentum",
  apply: (value: number, context: ModifierContext): number => {
    if (context.momentum === undefined) return value;
    
    // Momentum ranges from -1 (bad) to +1 (good), affects stats by ±10%
    const momentumEffect = 1 + context.momentum * 0.1;
    return value * momentumEffect;
  },
};

/**
 * Applies a chain of modifiers to a value
 */
export function applyModifiers(
  value: number,
  context: ModifierContext,
  modifiers: Modifier[]
): number {
  return modifiers.reduce((acc, modifier) => modifier.apply(acc, context), value);
}

/**
 * Convenience function for applying pitcher fatigue to a stat
 */
export function applyPitcherFatigue(value: number, inningsPitched: number): number {
  return pitcherFatigueModifier.apply(value, { inningsPitched });
}

