/**
 * Narrative Rules Engine
 *
 * Same architecture as decisionRulesEngine.ts (planning engine) but for
 * narrative text selection. Rules evaluate game context and return a
 * string pool; the engine picks randomly from the winner.
 *
 * Priority order: highest priority wins, first-match-wins.
 * If no rule matches, caller falls back to existing stat-tier generators.
 *
 * Adding new narrative scenarios: define a new NarrativeRule and add it
 * to NARRATIVE_RULES. Zero changes to narrativeEngine.ts required.
 */

import type { AtBatResult } from "../atBatSimulator";
import type { RandomProvider } from "../randomProvider";
import { randomChoice } from "../textPools";
import {
  type NarrativeContext,
  hasRISP,
  isLateGame,
  isCloseGame,
  isTrailing,
  isHighLeverageSituation,
  isPotentialWalkoff,
} from "./narrativeContext";
import {
  GRAND_SLAM_TEXTS,
  WALKOFF_HOMER_TEXTS,
  REDEMPTION_HOMER_TEXTS,
  CLUTCH_HOMER_TEXTS,
  CLUTCH_K_TEXTS,
  FRUSTRATION_K_TEXTS,
  TENSION_K_TEXTS,
  WALKOFF_HIT_TEXTS,
  REDEMPTION_HIT_TEXTS,
  CLUTCH_HIT_TEXTS,
  COMEBACK_HIT_TEXTS,
  CLUTCH_OUT_TEXTS,
  REDEMPTION_SETUP_TEXTS,
  REDEMPTION_PAYOFF_TEXTS,
} from "./situationalPools";

// ─────────────────────────────────────────────────────────────────────────────
// Rule type
// ─────────────────────────────────────────────────────────────────────────────

export interface NarrativeRule {
  /** Unique identifier (used in tests + audit) */
  id: string;

  /** Human-readable description */
  name: string;

  /**
   * Priority — higher = evaluated first; first match wins.
   * Suggested scale:
   *   100+  Absolute overrides (grand slam, walkoff)
   *    80+  Major situational (redemption, clutch)
   *    60+  Meaningful situational (RISP, comeback)
   *    40+  Mild situational (late-game flavor)
   *    Default fallback = caller uses stat-tier generators
   */
  priority: number;

  /** Evaluate context — return true if this rule should fire */
  matches: (ctx: NarrativeContext) => boolean;

  /** String pool to draw from when matched */
  pool: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate rules in priority order. Returns the selected text, or null if
 * no rule matches (caller should fall back to default generation).
 */
export function evaluateNarrativeRules(
  ctx: NarrativeContext,
  rng: RandomProvider,
  rules: NarrativeRule[] = NARRATIVE_RULES
): string | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (rule.matches(ctx)) {
      const text = fillTokens(randomChoice(rule.pool, rng), ctx);
      return text;
    }
  }

  return null; // no match — use stat-tier default
}

/**
 * Fill {batter}, {pitcher}, {abs}, {hits}, {k} tokens in a template string.
 */
function fillTokens(template: string, ctx: NarrativeContext): string {
  return template
    .replace("{batter}", ctx.batterName)
    .replace("{pitcher}", ctx.pitcherName)
    .replace("{abs}", String(ctx.batterHistory?.abs ?? 0))
    .replace("{hits}", String(ctx.batterHistory?.hits ?? 0))
    .replace("{k}", String(ctx.batterHistory?.strikeouts ?? 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — result category checks
// ─────────────────────────────────────────────────────────────────────────────

const HIT_RESULTS: AtBatResult[] = ["single", "double", "triple", "homerun"];
const NON_HR_HITS: AtBatResult[] = ["single", "double", "triple"];
const OUT_RESULTS: AtBatResult[] = ["groundout", "flyout", "lineout", "popout"];

const isHit = (r: AtBatResult) => HIT_RESULTS.includes(r);
const isNonHRHit = (r: AtBatResult) => NON_HR_HITS.includes(r);
const isOut = (r: AtBatResult) => OUT_RESULTS.includes(r);

// ─────────────────────────────────────────────────────────────────────────────
// Rules — ordered by conceptual priority (array order doesn't matter;
// evaluator sorts by .priority before evaluation)
// ─────────────────────────────────────────────────────────────────────────────

export const NARRATIVE_RULES: NarrativeRule[] = [

  // ── Priority 110: Absolute overrides ──────────────────────────────────────

  {
    id: "grand_slam",
    name: "Grand Slam — HR with 4 runs scoring",
    priority: 110,
    matches: (ctx) => ctx.result === "homerun" && ctx.runsScored >= 4,
    pool: GRAND_SLAM_TEXTS,
  },

  {
    id: "walkoff_homer",
    name: "Walk-off Homer — late game, trailing/tied, HR scores winning run",
    priority: 108,
    matches: (ctx) =>
      ctx.result === "homerun" && isPotentialWalkoff(ctx),
    pool: WALKOFF_HOMER_TEXTS,
  },

  {
    id: "walkoff_hit",
    name: "Walk-off Hit — late game, trailing/tied, hit scores winning run",
    priority: 106,
    matches: (ctx) =>
      isNonHRHit(ctx.result) && isPotentialWalkoff(ctx),
    pool: WALKOFF_HIT_TEXTS,
  },

  // ── Priority 90: Major situational overrides ──────────────────────────────

  {
    id: "redemption_homer",
    name: "Redemption Homer — batter was hitless this game",
    priority: 90,
    matches: (ctx) =>
      ctx.result === "homerun" &&
      (ctx.batterHistory?.hits ?? 1) === 0 &&
      (ctx.batterHistory?.abs ?? 0) >= 2,
    pool: REDEMPTION_HOMER_TEXTS,
  },

  {
    id: "clutch_homer",
    name: "Clutch Homer — high leverage, non-walkoff",
    priority: 85,
    matches: (ctx) =>
      ctx.result === "homerun" && isHighLeverageSituation(ctx),
    pool: CLUTCH_HOMER_TEXTS,
  },

  {
    id: "clutch_strikeout_pitcher",
    name: "Clutch K — pitcher dominates in high-leverage spot",
    priority: 88,
    matches: (ctx) =>
      ctx.result === "strikeout" &&
      isHighLeverageSituation(ctx) &&
      ctx.pitcherControl >= 65,
    pool: CLUTCH_K_TEXTS,
  },

  {
    id: "frustration_strikeout",
    name: "Frustration K — batter has 2+ Ks already today",
    priority: 82,
    matches: (ctx) =>
      ctx.result === "strikeout" &&
      (ctx.batterHistory?.strikeouts ?? 0) >= 2,
    pool: FRUSTRATION_K_TEXTS,
  },

  {
    id: "redemption_hit",
    name: "Redemption Hit — batter was hitless, finally connects (non-HR)",
    priority: 87,
    matches: (ctx) =>
      isNonHRHit(ctx.result) &&
      (ctx.batterHistory?.hits ?? 1) === 0 &&
      (ctx.batterHistory?.abs ?? 0) >= 2,
    pool: REDEMPTION_HIT_TEXTS,
  },

  {
    // Priority 93 intentionally supersedes redemption_homer (90) and redemption_hit (87).
    // When the redemptionOpportunity flag is set, the tracked-flag context is more specific
    // than the generic hitless-batter checks, so the payoff text takes precedence.
    // A hitless batter with the flag who hits a HR gets payoff text, not redemption-homer text.
    id: "redemption_payoff",
    name: "Redemption Payoff — tracked flag set, batter delivers a hit",
    priority: 93,
    matches: (ctx) =>
      ctx.batterHistory?.redemptionOpportunity === true &&
      isHit(ctx.result),
    pool: REDEMPTION_PAYOFF_TEXTS,
  },

  // ── Priority 70: Meaningful situational flavor ────────────────────────────

  {
    id: "setup_for_redemption",
    name: "Setup for Redemption — tracked flag set, batter fails again (out/strikeout)",
    priority: 75,
    matches: (ctx) =>
      ctx.batterHistory?.redemptionOpportunity === true &&
      (isOut(ctx.result) || ctx.result === "strikeout"),
    pool: REDEMPTION_SETUP_TEXTS,
  },

  {
    id: "clutch_hit_risp",
    name: "Clutch Hit — RISP, late or close game",
    priority: 70,
    matches: (ctx) =>
      isNonHRHit(ctx.result) &&
      hasRISP(ctx) &&
      ctx.runsScored > 0 &&
      (isLateGame(ctx) || isCloseGame(ctx)),
    pool: CLUTCH_HIT_TEXTS,
  },

  {
    id: "comeback_hit",
    name: "Comeback Hit — trailing, RISP, hits scores",
    priority: 68,
    matches: (ctx) =>
      isNonHRHit(ctx.result) &&
      isTrailing(ctx) &&
      hasRISP(ctx) &&
      ctx.runsScored > 0,
    pool: COMEBACK_HIT_TEXTS,
  },

  {
    id: "tension_late_strikeout",
    name: "Tension K — late game, close, neither pitcher clutch nor batter frustrated",
    priority: 60,
    matches: (ctx) =>
      ctx.result === "strikeout" &&
      isLateGame(ctx) &&
      isCloseGame(ctx),
    pool: TENSION_K_TEXTS,
  },

  {
    id: "clutch_out",
    name: "Clutch Out — batter fails with RISP in high-leverage spot",
    priority: 65,
    matches: (ctx) =>
      isOut(ctx.result) &&
      hasRISP(ctx) &&
      isHighLeverageSituation(ctx),
    pool: CLUTCH_OUT_TEXTS,
  },

];
