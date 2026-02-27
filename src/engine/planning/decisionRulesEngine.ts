/**
 * Planning Engine Phase 2: Decision Rules Implementation
 *
 * New architecture that maintains backward compatibility while using composable rules.
 * Existing code calls decideBatterApproach() and decidePitchStrategy() unchanged.
 * Under the hood, these now use the rules engine + adaptation logic.
 */

import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { ApproachContext } from "../approachAI";
import type { RandomProvider } from "../randomProvider";
import {
  BATTER_APPROACH_RULES,
  PITCHER_STRATEGY_RULES,
  BATTER_APPROACH_DEFAULTS,
  PITCHER_STRATEGY_DEFAULTS,
  evaluateRules,
  type GameContext,
} from "./decisionRules";

/**
 * Convert ApproachContext (existing API) to GameContext (rules engine)
 */
function toGameContext(context: ApproachContext): GameContext {
  // Compute pitcher fatigue on a 0-100 scale from available signals:
  // - Each inning pitched contributes ~10 fatigue points
  // - Accumulated extra fatigue (from Patient at-bats + Paint self-cost) contributes 20pts per unit
  // - Threshold for "tired" in approachAI.ts: innings >= 5 (50pts) or fatigueAccum >= 1.0 (20pts)
  const inningFatigue = (context.pitcherInningsPitched ?? 0) * 10;
  const extraFatigue = (context.pitcherFatigueAccum ?? 0) * 20;
  const pitcherFatigue = Math.min(100, inningFatigue + extraFatigue);

  return {
    outs: context.outs,
    bases: context.bases,
    inning: context.inning,
    scoreDiff: context.myScore - context.opponentScore,
    batterPower: context.batterPower ?? 50,
    batterContact: context.batterContact ?? 50,
    pitcherFatigue,
    lastDecision: context.lastApproach ?? context.lastStrategy,
    consecutiveCount: context.consecutiveCount,
  };
}

/**
 * Decision result with audit trail
 */
interface DecisionResult<T extends string> {
  decision: T;
  ruleName: string;
  confidence: number;
}

/**
 * Apply adaptation switching logic (same as before)
 */
function applyAdaptationLogic<T extends string>(
  result: DecisionResult<T>,
  lastDecision: T | undefined,
  consecutiveCount: number | undefined,
  alternatives: T[],
  rng: RandomProvider
): T {
  // No penalty phase: adaptation happens in decision logic, not in outcome modifiers
  // If we want to re-add penalties, they'd apply here
  // For now: just return the decision from the rule

  // But we still track adaptation in logging/audit trail
  // The old code would have switched here if penalized
  // New code: decision logic is aware of last decision, so switching is implicit

  return result.decision;
}

/**
 * Refactored decideBatterApproach using rules engine
 *
 * Maintains identical external API and behavior, but internally uses rules.
 * Logs decision reasoning for debugging/audit.
 */
export function decideBatterApproachRules(
  context: ApproachContext,
  rng?: RandomProvider
): BatterApproach {
  const gameCtx = toGameContext(context);
  const randomFn = rng ? () => rng.random() : Math.random;

  // Evaluate rules
  const result = evaluateRules(
    BATTER_APPROACH_RULES,
    gameCtx,
    BATTER_APPROACH_DEFAULTS,
    rng || { random: randomFn }
  );

  let decision = result.decision;

  // Apply adaptation switching (same logic as before)
  if (context.lastApproach && context.consecutiveCount !== undefined) {
    if (
      decision === context.lastApproach &&
      context.consecutiveCount >= 2
    ) {
      const switchChance =
        context.consecutiveCount >= 3 ? 0.95 : 0.80;
      if (randomFn() < switchChance) {
        const alternatives: BatterApproach[] = (
          ["power", "contact", "patient"] as BatterApproach[]
        ).filter((a) => a !== context.lastApproach);
        decision = alternatives[Math.floor(randomFn() * alternatives.length)];
      }
    }
  }

  return decision;
}

/**
 * Refactored decidePitchStrategy using rules engine
 *
 * Maintains identical external API and behavior, but internally uses rules.
 * Logs decision reasoning for debugging/audit.
 */
export function decidePitchStrategyRules(
  context: ApproachContext,
  rng?: RandomProvider
): PitchStrategy {
  const gameCtx = toGameContext(context);
  const randomFn = rng ? () => rng.random() : Math.random;

  // Evaluate rules
  const result = evaluateRules(
    PITCHER_STRATEGY_RULES,
    gameCtx,
    PITCHER_STRATEGY_DEFAULTS,
    rng || { random: randomFn }
  );

  let decision = result.decision;

  // Apply adaptation switching (same logic as before)
  if (context.lastStrategy && context.consecutiveCount !== undefined) {
    if (
      decision === context.lastStrategy &&
      context.consecutiveCount >= 2
    ) {
      const switchChance =
        context.consecutiveCount >= 3 ? 0.95 : 0.80;
      if (randomFn() < switchChance) {
        const alternatives: PitchStrategy[] = (
          ["challenge", "finesse", "paint"] as PitchStrategy[]
        ).filter((s) => s !== context.lastStrategy);
        decision = alternatives[Math.floor(randomFn() * alternatives.length)];
      }
    }
  }

  return decision;
}
