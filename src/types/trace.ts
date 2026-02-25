/**
 * Engine Trace Log Types
 *
 * Structured types for capturing every decision, roll, and system
 * that fires during game simulation. Used for debugging and verification.
 */

import type { ActiveAbilityContext } from "./ability";
import type { BatterApproach, PitchStrategy } from "./approach";

// ============================================
// STAT SNAPSHOTS
// ============================================

export interface BatterStatSnapshot {
  power: number;
  contact: number;
}

export interface PitcherStatSnapshot {
  velocity: number;
  control: number;
  break: number;
}

/** The stat pipeline for one at-bat, showing each modifier layer */
export interface StatPipeline {
  batter: {
    base: BatterStatSnapshot;
    withTechniques: BatterStatSnapshot;
    withEquipment: BatterStatSnapshot;
    withApproach: BatterStatSnapshot;
    withAbility: BatterStatSnapshot;
  };
  pitcher: {
    base: PitcherStatSnapshot;
    withTechniques: PitcherStatSnapshot;
    withEquipment: PitcherStatSnapshot;
    withFatigue: PitcherStatSnapshot;
    withStrategy: PitcherStatSnapshot;
    withAbility: PitcherStatSnapshot;
  };
  defenseGlove: number;
}

// ============================================
// RNG ROLLS
// ============================================

/** A single RNG roll and its context */
export interface RngRoll {
  label: string;
  rawValue: number;
  scaledValue?: number;
  threshold?: number;
  passed: boolean;
}

// ============================================
// RESOLUTION BRANCH
// ============================================

export type ResolutionBranch =
  | { type: "clash"; winner: "batter" | "pitcher"; batterRoll: number; pitcherRoll: number }
  | { type: "guaranteed_batter"; outcome: string }
  | { type: "guaranteed_pitcher"; outcome: string }
  | { type: "normal" };

// ============================================
// APPROACH / STRATEGY
// ============================================

export interface ApproachTrace {
  batterApproach?: BatterApproach;
  pitchStrategy?: PitchStrategy;
  approachAdaptation: number;
  strategyAdaptation: number;
  consecutiveBatterApproach: number;
  consecutivePitchStrategy: number;
}

// ============================================
// ABILITIES
// ============================================

export interface AbilityTrace {
  batterPassive?: ActiveAbilityContext | null;
  batterActive?: ActiveAbilityContext | null;
  batterMerged?: ActiveAbilityContext | null;
  pitcherPassive?: ActiveAbilityContext | null;
  pitcherActive?: ActiveAbilityContext | null;
  pitcherMerged?: ActiveAbilityContext | null;
}

// ============================================
// EXTRA BASES
// ============================================

export interface ExtraBaseTrace {
  runnerId: string;
  runnerSpeed: number;
  defenseGlove: number;
  fromBase: string;
  toBase: string;
  attemptChance: number;
  attemptRoll: number;
  attempted: boolean;
  successChance?: number;
  successRoll?: number;
  succeeded?: boolean;
}

// ============================================
// SPIRIT
// ============================================

export interface SpiritTrace {
  batterDelta: number;
  pitcherDelta: number;
  teamDelta: number;
}

// ============================================
// OUTCOME MODIFIERS
// ============================================

export interface OutcomeModifierTrace {
  strikeoutChance: {
    base: number;
    afterAbilities: number;
    afterApproachStrategy: number;
    final: number;
  };
  walkChance: {
    base: number;
    afterAbilities: number;
    afterApproachStrategy: number;
    final: number;
  };
  netScore?: {
    raw: number;
    afterAbilities: number;
    afterApproachStrategy: number;
    final: number;
  };
  hitRoll?: {
    base: number;
    afterAbilities: number;
    afterApproachStrategy: number;
    final: number;
  };
}

// ============================================
// PER AT-BAT TRACE
// ============================================

export interface AtBatTrace {
  index: number;
  inning: number;
  isTop: boolean;
  batterId: string;
  batterName: string;
  pitcherId: string;
  pitcherName: string;
  outsBefore: number;
  basesBefore: [boolean, boolean, boolean];

  resolution: ResolutionBranch;
  approach: ApproachTrace;
  abilities: AbilityTrace;
  statPipeline?: StatPipeline;
  outcomeModifiers?: OutcomeModifierTrace;
  rolls: RngRoll[];
  extraBases: ExtraBaseTrace[];
  spirit: SpiritTrace;

  outcome: string;
  runsScored: number;
  outsAfter: number;
  basesAfter: [boolean, boolean, boolean];
}

// ============================================
// GAME-LEVEL EVENTS
// ============================================

export type GameLevelEvent =
  | { type: "inning_start"; inning: number; isTop: boolean }
  | { type: "inning_end"; inning: number; isTop: boolean; runs: number; hits: number }
  | { type: "pitcher_change"; inning: number; team: "home" | "away"; oldPitcherName: string; newPitcherName: string; reason: string };

// ============================================
// FULL GAME TRACE
// ============================================

export interface GameTraceLog {
  version: 1;
  timestamp: string;
  seed?: number;
  atBats: AtBatTrace[];
  gameEvents: GameLevelEvent[];
  finalScore: { home: number; away: number };
  totalInnings: number;
}
