/**
 * Decision Rules Framework for Planning Engine (Phase 2 Refactor)
 *
 * Replaces nested if-else logic with composable, testable rules.
 * Each rule is ~5 lines and evaluates a specific game situation.
 *
 * Architecture:
 * 1. Rules are evaluated in priority order (highest confidence first)
 * 2. First matching rule wins
 * 3. If no rule matches, fall back to default distribution
 * 4. Adaptation logic applies AFTER rule selection
 */

import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { RandomProvider } from "./randomProvider";

/**
 * Core types for the rules framework
 */
export interface DecisionRule<T extends string> {
  /** Unique identifier for this rule */
  id: string;

  /** Human-readable name (used in audit trails) */
  name: string;

  /** Priority/confidence (0-1). Higher = evaluated first, used as fallback weight */
  confidence: number;

  /** Evaluates the game context and returns a decision if this rule matches */
  evaluate: (context: GameContext) => T | null;
}

/**
 * Normalized game context passed to all rules
 * (derived from ApproachContext but cleaner for rule evaluation)
 */
export interface GameContext {
  // Situation
  outs: number;
  bases: [boolean, boolean, boolean];
  inning: number;
  scoreDiff: number; // myScore - opponentScore

  // Player stats (defaults: 50 if not provided)
  batterPower: number;
  batterContact: number;
  pitcherFatigue: number; // 0-100 (higher = more tired)

  // Adaptation state
  lastDecision?: BatterApproach | PitchStrategy;
  consecutiveCount?: number;
}

/**
 * Evaluate rules in priority order until one matches
 * Falls back to default distribution if no rule matches
 */
export function evaluateRules<T extends string>(
  rules: DecisionRule<T>[],
  context: GameContext,
  defaults: T[],
  rng: RandomProvider
): { decision: T; ruleName: string; confidence: number } {
  // Sort by confidence descending
  const sorted = [...rules].sort((a, b) => b.confidence - a.confidence);

  // Evaluate each rule in order
  for (const rule of sorted) {
    const decision = rule.evaluate(context);
    if (decision) {
      return {
        decision,
        ruleName: rule.name,
        confidence: rule.confidence,
      };
    }
  }

  // Fallback: use default distribution
  const idx = Math.floor(rng.random() * defaults.length);
  return {
    decision: defaults[idx],
    ruleName: "default",
    confidence: 0.5,
  };
}

/**
 * BATTER APPROACH RULES
 *
 * Decision: which approach (power, contact, patient) for this at-bat
 */

export const BATTER_APPROACH_RULES: DecisionRule<BatterApproach>[] = [
  {
    id: "runner_on_third",
    name: "Runner on 3rd, <2 outs → Contact (sac fly)",
    confidence: 0.95,
    evaluate: (ctx) => {
      if (ctx.bases[2] && ctx.outs < 2) {
        return "contact";
      }
      return null;
    },
  },

  {
    id: "down_4_plus_anytime",
    name: "Down 4+ any time → Power (need miracles)",
    confidence: 0.90,
    evaluate: (ctx) => {
      if (ctx.scoreDiff <= -4) {
        return "power";
      }
      return null;
    },
  },

  {
    id: "down_3_plus_late",
    name: "Down 3+ late (inning 7+) → Power",
    confidence: 0.85,
    evaluate: (ctx) => {
      if (ctx.inning >= 7 && ctx.scoreDiff <= -3) {
        return "power";
      }
      return null;
    },
  },

  {
    id: "bases_loaded",
    name: "Bases loaded → Contact (protect against outs)",
    confidence: 0.80,
    evaluate: (ctx) => {
      if (ctx.bases[0] && ctx.bases[1] && ctx.bases[2]) {
        return "contact";
      }
      return null;
    },
  },

  {
    id: "tired_pitcher",
    name: "Facing tired pitcher (60%+ fatigue) → Patient (exploit control loss)",
    confidence: 0.80,
    evaluate: (ctx) => {
      if (ctx.pitcherFatigue >= 60) {
        return "patient";
      }
      return null;
    },
  },

  {
    id: "two_outs_empty",
    name: "2 outs, bases empty → Patient (try to get on)",
    confidence: 0.75,
    evaluate: (ctx) => {
      const runnersOnBase = ctx.bases.filter(Boolean).length;
      if (ctx.outs === 2 && runnersOnBase === 0) {
        return "patient";
      }
      return null;
    },
  },

  {
    id: "up_comfortably",
    name: "Up 3+ runs → Contact (don't risk outs)",
    confidence: 0.75,
    evaluate: (ctx) => {
      if (ctx.scoreDiff >= 3) {
        return "contact";
      }
      return null;
    },
  },

  {
    id: "high_power_batter",
    name: "High power batter (75+) → Contact (control variance)",
    confidence: 0.70,
    evaluate: (ctx) => {
      if (ctx.batterPower >= 75) {
        return "contact";
      }
      return null;
    },
  },
];

/**
 * PITCHER STRATEGY RULES
 *
 * Decision: which strategy (challenge, finesse, paint) to throw
 */

export const PITCHER_STRATEGY_RULES: DecisionRule<PitchStrategy>[] = [
  {
    id: "bases_loaded",
    name: "Bases loaded → Paint (nibble corners, avoid damage)",
    confidence: 0.95,
    evaluate: (ctx) => {
      if (ctx.bases[0] && ctx.bases[1] && ctx.bases[2]) {
        return "paint";
      }
      return null;
    },
  },

  {
    id: "high_power_batter",
    name: "High power batter (70+) → Finesse (keep ball in park)",
    confidence: 0.90,
    evaluate: (ctx) => {
      if (ctx.batterPower >= 70) {
        return "finesse";
      }
      return null;
    },
  },

  {
    id: "high_contact_batter",
    name: "High contact batter (70+) → Challenge (overpower)",
    confidence: 0.85,
    evaluate: (ctx) => {
      if (ctx.batterContact >= 70) {
        return "challenge";
      }
      return null;
    },
  },

  {
    id: "runners_in_scoring",
    name: "Runners in scoring position → Paint (careful approach)",
    confidence: 0.80,
    evaluate: (ctx) => {
      const runnersInScoring = ctx.bases[1] || ctx.bases[2];
      if (runnersInScoring) {
        return "paint";
      }
      return null;
    },
  },

  {
    id: "ahead_comfortably",
    name: "Ahead 3+ runs → Challenge (go right at them)",
    confidence: 0.75,
    evaluate: (ctx) => {
      if (ctx.scoreDiff >= 3) {
        return "challenge";
      }
      return null;
    },
  },

  {
    id: "down_significantly",
    name: "Down 3+ runs → Finesse (limit damage)",
    confidence: 0.70,
    evaluate: (ctx) => {
      if (ctx.scoreDiff <= -3) {
        return "finesse";
      }
      return null;
    },
  },

  {
    id: "pitcher_tired",
    name: "Pitcher tired (70%+ fatigue) → Finesse (preserve stamina)",
    confidence: 0.70,
    evaluate: (ctx) => {
      if (ctx.pitcherFatigue >= 70) {
        return "finesse";
      }
      return null;
    },
  },
];

/**
 * Default distributions (used when no rule matches)
 */
export const BATTER_APPROACH_DEFAULTS: BatterApproach[] = [
  "contact",
  "contact",
  "contact",
  "contact",
  "contact",
  "contact",
  "contact",
  "contact",
  "contact", // 9/20 = 45%
  "power",
  "power",
  "power",
  "power",
  "power",
  "power", // 6/20 = 30%
  "patient",
  "patient",
  "patient",
  "patient",
  "patient", // 5/20 = 25%
];

export const PITCHER_STRATEGY_DEFAULTS: PitchStrategy[] = [
  "challenge",
  "challenge",
  "challenge",
  "challenge",
  "challenge",
  "challenge",
  "challenge",
  "challenge", // 8/20 = 40%
  "finesse",
  "finesse",
  "finesse",
  "finesse",
  "finesse",
  "finesse",
  "finesse", // 7/20 = 35%
  "paint",
  "paint",
  "paint",
  "paint",
  "paint", // 5/20 = 25%
];
