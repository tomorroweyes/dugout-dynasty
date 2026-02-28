/**
 * Leverage Calculator
 *
 * Determines how "high-stakes" the current at-bat is, used to decide when
 * to pause auto-simulation and ask the player for an explicit decision.
 *
 * LI is computed via a Poisson win-expectancy model (see winExpectancy.ts).
 * Scale: average ≈ 1.0 | low < 0.85 | medium 0.85–2.0 | high ≥ 2.0
 * Only ~10% of real game situations reach ≥ 2.0.
 *
 * The threshold is dynamic based on inning to create a natural tension arc:
 * - Innings 1-5: threshold 2.0 (rarer, let the game flow)
 * - Innings 6-7: threshold 1.7 (moderate buildup)
 * - Innings 8-9+: threshold 1.3 (more moments, late-game drama)
 *
 * Overall this produces fewer interactive moments early (game flow) and more
 * late (climactic finishes) without constantly interrupting play.
 */

import type { InteractiveMatchState } from "./interactiveMatchEngine";
import { computeLeverageIndex } from "./winExpectancy";

/**
 * Get the dynamic high-leverage threshold based on current inning.
 * Tighter thresholds (lower values) in late innings mean more interactive moments.
 */
export function getDynamicLeverageThreshold(inning: number): number {
  if (inning <= 5) return 2.0;    // Innings 1-5: rare, let the game flow
  if (inning <= 7) return 1.7;    // Innings 6-7: moderate buildup
  return 1.3;                     // Innings 8+: more moments, late-game drama
}

/**
 * Returns the leverage index for the current at-bat.
 * Average value is 1.0. Higher = more important at-bat.
 */
export function calculateAtBatLeverage(state: InteractiveMatchState): number {
  return computeLeverageIndex(state);
}

/**
 * Returns true when the current at-bat is high-stakes enough to pause
 * auto-simulation and ask the player for an explicit decision.
 * Uses dynamic thresholds based on inning.
 */
export function isHighLeverage(state: InteractiveMatchState): boolean {
  const leverage = calculateAtBatLeverage(state);
  const threshold = getDynamicLeverageThreshold(state.inning);
  return leverage >= threshold;
}
