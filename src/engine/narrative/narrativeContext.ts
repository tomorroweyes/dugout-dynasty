/**
 * Narrative Context — rich game state passed to the narrative rules engine.
 *
 * Extends the basic result/player info with situation-awareness so rules
 * can produce text that reflects what's actually happening in the game.
 */

import type { AtBatResult } from "../atBatSimulator";
import type { BatterHistory } from "../narrativeEngine";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { MentalSkillType } from "@/types/mentalSkills";

/** Lightweight mental skill snapshot for narrative combo detection. */
export interface MentalSkillSnapshot {
  skillId: MentalSkillType;
  rank: number;
  isActive: boolean;
}

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

  /**
   * Active mental skills for the batter (rank + active status).
   * Used to detect individual mental-skill combos (e.g. Clutch Legend).
   * Only active skills are included (confidence >= threshold).
   */
  batterMentalSkills?: ReadonlyArray<MentalSkillSnapshot>;

  // ── Approach / strategy ───────────────────────────────────────────────────
  /** Batter's chosen approach for this at-bat (undefined if AI / not chosen) */
  batterApproach?: BatterApproach;
  /** Pitcher's chosen strategy for this at-bat (undefined if AI / not chosen) */
  pitchStrategy?: PitchStrategy;
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

/**
 * Counter matrix (rock-paper-scissors):
 *   power beats finesse   — power hitter feasts on off-speed pitching
 *   contact beats challenge — contact hitter neutralises pure heat
 *   patient beats paint     — patient eye draws walks vs. a corner-nibbler
 *
 * Returns true when the batter's approach directly counters the pitcher's
 * strategy, AND both sides chose (i.e. neither is undefined).
 */
export function approachBeatsStrategy(ctx: NarrativeContext): boolean {
  const { batterApproach: a, pitchStrategy: s } = ctx;
  if (!a || !s) return false;
  return (
    (a === "power" && s === "finesse") ||
    (a === "contact" && s === "challenge") ||
    (a === "patient" && s === "paint")
  );
}

/**
 * Mismatch — the pitcher's strategy exploited the batter's approach:
 *   paint  beats power   — precise corners expose a free-swinging approach
 *   finesse beats contact — soft stuff produces exactly the weak contact it wants
 *   challenge beats patient — pure heat prevents working the count
 *
 * Returns true when the pitcher's strategy has the upper hand.
 */
export function strategyBeatsApproach(ctx: NarrativeContext): boolean {
  const { batterApproach: a, pitchStrategy: s } = ctx;
  if (!a || !s) return false;
  return (
    (a === "power" && s === "paint") ||
    (a === "contact" && s === "finesse") ||
    (a === "patient" && s === "challenge")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mental Skill Combo Predicates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clutch Legend combo: batter has both ice_veins (rank ≥ 3) AND
 * clutch_composure (rank ≥ 3), both active. In high-leverage situations
 * these two skills compound — nerves of steel meets peak-pressure lift.
 *
 * First time this fires for a player it should feel like a discovery.
 */
export function hasClutchLegendCombo(ctx: NarrativeContext): boolean {
  const skills = ctx.batterMentalSkills;
  if (!skills || skills.length === 0) return false;
  const hasIceVeins = skills.some(
    (s) => s.skillId === "ice_veins" && s.rank >= 3 && s.isActive
  );
  const hasClutchComposure = skills.some(
    (s) => s.skillId === "clutch_composure" && s.rank >= 3 && s.isActive
  );
  return hasIceVeins && hasClutchComposure;
}

/**
 * Near-combo hint: both ice_veins AND clutch_composure are active
 * and at rank ≥ 2, but not yet both at rank 3+ (combo not yet unlocked).
 *
 * Used to fire a subtle "something's building" hint narrative so players
 * discover the combo through play rather than a guide.
 */
export function isNearClutchLegend(ctx: NarrativeContext): boolean {
  const skills = ctx.batterMentalSkills;
  if (!skills || skills.length === 0) return false;
  const iv = skills.find((s) => s.skillId === "ice_veins");
  const cc = skills.find((s) => s.skillId === "clutch_composure");
  if (!iv || !cc) return false;
  if (!iv.isActive || !cc.isActive) return false;
  // Both active at rank 2+, but not both at rank 3+ yet
  const bothAtLeastTwo = iv.rank >= 2 && cc.rank >= 2;
  const notBothThree   = !(iv.rank >= 3 && cc.rank >= 3);
  return bothAtLeastTwo && notBothThree;
}

// ─────────────────────────────────────────────────────────────────────────────
// Veteran's Eye Combo Predicates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Veteran's Eye combo: batter has both veteran_poise (rank ≥ 3) AND
 * pitch_recognition (rank ≥ 3), both active. Years of experience fused with
 * elite pitch-reading — the batter who has seen every pitcher tendency fires
 * before the ball is even halfway to the plate.
 *
 * Distinct from Clutch Legend (pressure/nerves) — this combo is about pure
 * mental mastery of the game itself, earned over a long career.
 */
export function hasVeteranEyeCombo(ctx: NarrativeContext): boolean {
  const skills = ctx.batterMentalSkills;
  if (!skills || skills.length === 0) return false;
  const hasVeteranPoise = skills.some(
    (s) => s.skillId === "veteran_poise" && s.rank >= 3 && s.isActive
  );
  const hasPitchRecognition = skills.some(
    (s) => s.skillId === "pitch_recognition" && s.rank >= 3 && s.isActive
  );
  return hasVeteranPoise && hasPitchRecognition;
}

/**
 * Near-combo hint: both veteran_poise AND pitch_recognition are active
 * and at rank ≥ 2, but not yet both at rank 3+ (combo not yet unlocked).
 *
 * Subtle "something is connecting" signal fires before the full combo unlocks.
 */
export function isNearVeteranEye(ctx: NarrativeContext): boolean {
  const skills = ctx.batterMentalSkills;
  if (!skills || skills.length === 0) return false;
  const vp = skills.find((s) => s.skillId === "veteran_poise");
  const pr = skills.find((s) => s.skillId === "pitch_recognition");
  if (!vp || !pr) return false;
  if (!vp.isActive || !pr.isActive) return false;
  // Both active at rank 2+, but not both at rank 3+ yet
  const bothAtLeastTwo = vp.rank >= 2 && pr.rank >= 2;
  const notBothThree   = !(vp.rank >= 3 && pr.rank >= 3);
  return bothAtLeastTwo && notBothThree;
}
