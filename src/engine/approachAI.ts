/**
 * Approach/Strategy AI
 *
 * Game-state-aware decision-making for batter approach and pitch strategy.
 * Used for opponent decisions in interactive matches and all decisions
 * in non-interactive/auto-sim matches.
 *
 * Key design: choices are based on VISIBLE game state (score, outs, bases,
 * stats, fatigue), not hidden RPS. A thoughtful player should consistently
 * outperform a player who picks the same thing every time.
 *
 * Adaptation awareness: AI avoids repeating the same approach/strategy
 * when adaptation penalties would reduce its effectiveness.
 */

import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { RandomProvider } from "./randomProvider";

export interface ApproachContext {
  outs: number;
  bases: [boolean, boolean, boolean];
  myScore: number;
  opponentScore: number;
  inning: number;
  batterPower?: number;
  batterContact?: number;
  pitcherInningsPitched?: number;
  // Adaptation awareness
  lastApproach?: BatterApproach;
  lastStrategy?: PitchStrategy;
  consecutiveCount?: number;
}

/**
 * AI decision for batter approach based on game state.
 * Adaptation-aware: strongly prefers switching when penalized.
 */
export function decideBatterApproach(
  context: ApproachContext,
  rng?: RandomProvider
): BatterApproach {
  const random = rng ? () => rng.random() : Math.random;
  const scoreDiff = context.myScore - context.opponentScore;
  const isLate = context.inning >= 7;
  const runnerOnThird = context.bases[2];
  const runnersOnBase = context.bases.filter(Boolean).length;
  const pitcherTired = (context.pitcherInningsPitched ?? 0) >= 5;
  const basesLoaded = context.bases[0] && context.bases[1] && context.bases[2];

  // Get the "natural" choice first, then maybe override for adaptation
  let preferred: BatterApproach;

  // Runner on 3rd, less than 2 outs → Contact (sac fly / ball in play scores run)
  if (runnerOnThird && context.outs < 2) {
    preferred = random() < 0.8 ? "contact" : "power";
  }
  // Down 3+ runs late → Power (need miracles)
  else if (isLate && scoreDiff <= -3) {
    preferred = random() < 0.7 ? "power" : "contact";
  }
  // Down 4+ any time → lean Power
  else if (scoreDiff <= -4) {
    preferred = random() < 0.6 ? "power" : "contact";
  }
  // Facing tired pitcher → Patient (exploit declining control)
  else if (pitcherTired) {
    preferred = random() < 0.5 ? "patient" : "contact";
  }
  // Bases loaded → Power (grand slam opportunity)
  else if (basesLoaded) {
    preferred = random() < 0.6 ? "power" : "contact";
  }
  // 2 outs, nobody on → Patient (try to get on base)
  else if (context.outs === 2 && runnersOnBase === 0) {
    const roll = random();
    if (roll < 0.4) preferred = "patient";
    else if (roll < 0.75) preferred = "contact";
    else preferred = "power";
  }
  // Up comfortably (3+ runs) → Contact (keep it going, don't risk outs)
  else if (scoreDiff >= 3) {
    preferred = random() < 0.6 ? "contact" : "patient";
  }
  // Default distribution: 45% contact, 30% power, 25% patient
  else {
    const roll = random();
    if (roll < 0.45) preferred = "contact";
    else if (roll < 0.75) preferred = "power";
    else preferred = "patient";
  }

  // Adaptation override: if repeating and penalized, try to switch
  if (context.lastApproach && context.consecutiveCount !== undefined) {
    if (preferred === context.lastApproach && context.consecutiveCount >= 2) {
      // Strongly prefer switching when penalized
      const switchChance = context.consecutiveCount >= 3 ? 0.95 : 0.80;
      if (random() < switchChance) {
        // Pick a different approach
        const alternatives: BatterApproach[] = (["power", "contact", "patient"] as BatterApproach[])
          .filter((a) => a !== context.lastApproach);
        preferred = alternatives[Math.floor(random() * alternatives.length)];
      }
    }
  }

  return preferred;
}

/**
 * AI decision for pitcher strategy based on game state.
 * Adaptation-aware: strongly prefers switching when penalized.
 */
export function decidePitchStrategy(
  context: ApproachContext,
  rng?: RandomProvider
): PitchStrategy {
  const random = rng ? () => rng.random() : Math.random;
  const runnersInScoring = context.bases[1] || context.bases[2];
  const basesLoaded = context.bases[0] && context.bases[1] && context.bases[2];
  const batterPower = context.batterPower ?? 50;
  const batterContact = context.batterContact ?? 50;
  const scoreDiff = context.myScore - context.opponentScore;

  let preferred: PitchStrategy;

  // Bases loaded → Paint (nibble corners, avoid damage)
  if (basesLoaded) {
    preferred = random() < 0.6 ? "paint" : "finesse";
  }
  // High power batter (70+) → Finesse (keep ball in park)
  else if (batterPower >= 70) {
    const roll = random();
    if (roll < 0.5) preferred = "finesse";
    else if (roll < 0.8) preferred = "paint";
    else preferred = "challenge";
  }
  // High contact batter (70+) → Challenge (overpower)
  else if (batterContact >= 70) {
    preferred = random() < 0.5 ? "challenge" : "finesse";
  }
  // Runners in scoring position → Paint (careful approach)
  else if (runnersInScoring) {
    const roll = random();
    if (roll < 0.4) preferred = "paint";
    else if (roll < 0.75) preferred = "finesse";
    else preferred = "challenge";
  }
  // Ahead comfortably → Challenge (go right at them)
  else if (scoreDiff >= 3) {
    preferred = random() < 0.6 ? "challenge" : "finesse";
  }
  // Default distribution: 40% challenge, 35% finesse, 25% paint
  else {
    const roll = random();
    if (roll < 0.4) preferred = "challenge";
    else if (roll < 0.75) preferred = "finesse";
    else preferred = "paint";
  }

  // Adaptation override: if repeating and penalized, try to switch
  if (context.lastStrategy && context.consecutiveCount !== undefined) {
    if (preferred === context.lastStrategy && context.consecutiveCount >= 2) {
      const switchChance = context.consecutiveCount >= 3 ? 0.95 : 0.80;
      if (random() < switchChance) {
        const alternatives: PitchStrategy[] = (["challenge", "finesse", "paint"] as PitchStrategy[])
          .filter((s) => s !== context.lastStrategy);
        preferred = alternatives[Math.floor(random() * alternatives.length)];
      }
    }
  }

  return preferred;
}
