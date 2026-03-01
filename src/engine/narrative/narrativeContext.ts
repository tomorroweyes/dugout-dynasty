/**
 * Narrative Context — rich game state passed to the narrative rules engine.
 *
 * Extends the basic result/player info with situation-awareness so rules
 * can produce text that reflects what's actually happening in the game.
 */

import type { AtBatResult } from "../atBatSimulator";
import type { BatterHistory } from "../narrativeEngine";

export interface NarrativeContext {
  // ── Core outcome ──────────────────────────────────────────────────────────
  result: AtBatResult;
  runsScored: number;

  // ── Game situation ────────────────────────────────────────────────────────
  inning: number;          // 1-based
  outs: number;            // 0-2 (before this play resolves)
  scoreDiff: number;       // offense POV: positive = offense is winning
  bases: [boolean, boolean, boolean]; // [1st, 2nd, 3rd]

  // ── Player context ────────────────────────────────────────────────────────
  batterName: string;      // batter.surname
  pitcherName: string;     // pitcher.surname
  batterPower: number;
  batterContact: number;
  pitcherVelocity: number;
  pitcherControl: number;

  // ── Narrative enrichment ─────────────────────────────────────────────────
  isCritical: boolean;     // crit roll fired
  batterHistory?: BatterHistory; // cumulative game stats for this batter
}

/**
 * Convenience predicates used by multiple rules.
 */

/** Runners in scoring position (2nd or 3rd occupied) */
export function hasRISP(ctx: NarrativeContext): boolean {
  return ctx.bases[1] || ctx.bases[2];
}

/** Late game (inning 8+) */
export function isLateGame(ctx: NarrativeContext): boolean {
  return ctx.inning >= 8;
}

/** Close game (within 2 runs either way) */
export function isCloseGame(ctx: NarrativeContext): boolean {
  return Math.abs(ctx.scoreDiff) <= 2;
}

/** Offense is trailing */
export function isTrailing(ctx: NarrativeContext): boolean {
  return ctx.scoreDiff < 0;
}

/**
 * Simple high-leverage proxy: late + close, or two outs with runners,
 * or potential walk-off (late game, trailing/tied, runners scoring).
 */
export function isHighLeverageSituation(ctx: NarrativeContext): boolean {
  return (
    (isLateGame(ctx) && isCloseGame(ctx)) ||
    (ctx.outs === 2 && (ctx.bases[0] || ctx.bases[1] || ctx.bases[2])) ||
    (ctx.inning >= 9 && ctx.scoreDiff <= 0)
  );
}

/**
 * Potential walk-off: late game, offense is tied or trailing, runs scored
 * would put them ahead.
 */
export function isPotentialWalkoff(ctx: NarrativeContext): boolean {
  return ctx.inning >= 9 && ctx.scoreDiff <= 0 && ctx.runsScored > 0;
}
