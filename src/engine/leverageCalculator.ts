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
 * The game threshold is set at 1.5 (upper-medium leverage) to produce
 * interactive moments in ~25–30% of at-bats rather than the real-baseball 10%.
 */

import type { InteractiveMatchState } from "./interactiveMatchEngine";
import { computeLeverageIndex } from "./winExpectancy";

export const HIGH_LEVERAGE_THRESHOLD = 1.5;

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
 */
export function isHighLeverage(state: InteractiveMatchState): boolean {
  return calculateAtBatLeverage(state) >= HIGH_LEVERAGE_THRESHOLD;
}
