/**
 * Batter Approach & Pitcher Strategy Types
 *
 * Free choices available every at-bat that create meaningful
 * tradeoffs based on game state. These layer UNDER abilities.
 */

// Batter chooses one approach per at-bat
export type BatterApproach = "power" | "contact" | "patient";

// Pitcher/defender chooses one strategy per at-bat
export type PitchStrategy = "challenge" | "finesse" | "paint";

export interface BatterApproachConfig {
  id: BatterApproach;
  label: string;
  description: string;
  shortDescription: string;
  icon: string;
  statModifiers: {
    power?: number;
    contact?: number;
  };
  outcomeModifiers: {
    homerunBonus?: number;
    strikeoutBonus?: number;
    walkBonus?: number;
    hitBonus?: number;
  };
  /** Extra fatigue applied to opposing pitcher per at-bat (Patient wears pitchers down) */
  fatigueEffect?: number;
}

export interface PitchStrategyConfig {
  id: PitchStrategy;
  label: string;
  description: string;
  shortDescription: string;
  icon: string;
  statModifiers: {
    velocity?: number;
    control?: number;
    break?: number;
  };
  outcomeModifiers: {
    strikeoutBonus?: number;
    walkBonus?: number;
    homerunBonus?: number;
    hitBonus?: number;
  };
  /** Extra fatigue applied to the pitcher per at-bat when using this strategy (Paint is exhausting) */
  fatigueCost?: number;
}
