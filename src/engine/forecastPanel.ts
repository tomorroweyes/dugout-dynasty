import { BATTER_APPROACHES, PITCH_STRATEGIES } from "@/engine/approachConfig";
import { GAME_CONSTANTS } from "@/engine/constants";
import type { BatterApproach, PitchStrategy } from "@/types/approach";

export type ForecastRiskTag = "Low" | "Medium" | "High";

export interface ForecastOutcomeTilt {
  kRisk: ForecastRiskTag;
  bbPressure: ForecastRiskTag;
  xbhPressure: ForecastRiskTag;
}

export interface ForecastSnapshot {
  riskTag: ForecastRiskTag;
  tilt: ForecastOutcomeTilt;
  adaptationWarning: string | null;
  fatiguePreview: string | null;
  leverageLabel: string | null;
}

export interface LeverageContext {
  inning: number;
  myRuns: number;
  opponentRuns: number;
  bases: [boolean, boolean, boolean];
}

export function getLeverageLabel(ctx: LeverageContext): string | null {
  const diff = Math.abs(ctx.myRuns - ctx.opponentRuns);
  const isLate = ctx.inning >= 7;
  const isClose = diff <= 2;
  const runnersOn = ctx.bases.some(Boolean);

  if (isLate && isClose && runnersOn) return "CRITICAL";
  if (isLate && isClose) return "HIGH STAKES";
  return null;
}

interface BattingForecastContext {
  mode: "batting";
  approach: BatterApproach;
  lastApproach: BatterApproach | null;
  consecutiveApproach: number;
}

interface PitchingForecastContext {
  mode: "pitching";
  strategy: PitchStrategy;
  lastStrategy: PitchStrategy | null;
  consecutiveStrategy: number;
}

export type ForecastContext = BattingForecastContext | PitchingForecastContext;

function toRiskTag(score: number): ForecastRiskTag {
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getAdaptationEffectiveness(isRepeated: boolean, consecutiveCount: number): number {
  if (!isRepeated) return 1;
  const scale = GAME_CONSTANTS.ADAPTATION.PENALTY_SCALE;
  const index = Math.min(Math.max(consecutiveCount, 0), scale.length - 1);
  return scale[index];
}

function getBattingRisk(approach: BatterApproach): ForecastRiskTag {
  const config = BATTER_APPROACHES[approach];
  const strikeoutBonus = config.outcomeModifiers.strikeoutBonus ?? 0;
  const homerunBonus = config.outcomeModifiers.homerunBonus ?? 0;
  const walkBonus = config.outcomeModifiers.walkBonus ?? 0;
  const riskScore = 45 + strikeoutBonus * 3 + homerunBonus + Math.abs(walkBonus);
  return toRiskTag(riskScore);
}

function getPitchingRisk(strategy: PitchStrategy): ForecastRiskTag {
  const config = PITCH_STRATEGIES[strategy];
  const strikeoutBonus = config.outcomeModifiers.strikeoutBonus ?? 0;
  const homerunBonus = config.outcomeModifiers.homerunBonus ?? 0;
  const walkBonus = config.outcomeModifiers.walkBonus ?? 0;
  const riskScore = 45 - strikeoutBonus * 2 + homerunBonus * 6 + walkBonus * 2;
  return toRiskTag(riskScore);
}

function getBattingTilt(approach: BatterApproach): ForecastOutcomeTilt {
  const modifiers = BATTER_APPROACHES[approach].outcomeModifiers;

  // Baseline 25 (not 45) so zero-modifier fields resolve to Low instead of Medium.
  // Multipliers scaled up so significant modifiers (±5) still reach High/Low.
  const kRiskScore = 25 + (modifiers.strikeoutBonus ?? 0) * 7;
  const bbPressureScore = 25 + (modifiers.walkBonus ?? 0) * 7;
  const xbhPressureScore =
    25 + (modifiers.homerunBonus ?? 0) * 6 + (modifiers.hitBonus ?? 0) * 2;

  return {
    kRisk: toRiskTag(kRiskScore),
    bbPressure: toRiskTag(bbPressureScore),
    xbhPressure: toRiskTag(xbhPressureScore),
  };
}

function getPitchingTilt(strategy: PitchStrategy): ForecastOutcomeTilt {
  const modifiers = PITCH_STRATEGIES[strategy].outcomeModifiers;

  const kRiskScore = 25 - (modifiers.strikeoutBonus ?? 0) * 7;
  const bbPressureScore = 25 + (modifiers.walkBonus ?? 0) * 7;
  const xbhPressureScore =
    25 + (modifiers.homerunBonus ?? 0) * 6 + (modifiers.hitBonus ?? 0) * 2;

  return {
    kRisk: toRiskTag(kRiskScore),
    bbPressure: toRiskTag(bbPressureScore),
    xbhPressure: toRiskTag(xbhPressureScore),
  };
}

export function getBatterApproachQuality(approach: BatterApproach): "Strong" | "OK" | "Risky" {
  const risk = getBattingRisk(approach);
  if (risk === "Low") return "Strong";
  if (risk === "Medium") return "OK";
  return "Risky";
}

export function getPitchStrategyQuality(strategy: PitchStrategy): "Strong" | "OK" | "Risky" {
  const risk = getPitchingRisk(strategy);
  if (risk === "Low") return "Strong";
  if (risk === "Medium") return "OK";
  return "Risky";
}

export function getRiskTag(context: ForecastContext): ForecastRiskTag {
  if (context.mode === "batting") {
    return getBattingRisk(context.approach);
  }
  return getPitchingRisk(context.strategy);
}

export function getOutcomeTilt(context: ForecastContext): ForecastOutcomeTilt {
  if (context.mode === "batting") {
    return getBattingTilt(context.approach);
  }
  return getPitchingTilt(context.strategy);
}

export function getAdaptationWarning(context: ForecastContext): string | null {
  if (context.mode === "batting") {
    const isRepeated = context.approach === context.lastApproach;
    const effectiveness = getAdaptationEffectiveness(isRepeated, context.consecutiveApproach);
    if (effectiveness >= 1) return null;
    return `Repeat penalty active (${Math.round(effectiveness * 100)}%)`;
  }

  const isRepeated = context.strategy === context.lastStrategy;
  const effectiveness = getAdaptationEffectiveness(isRepeated, context.consecutiveStrategy);
  if (effectiveness >= 1) return null;
  return `Repeat penalty active (${Math.round(effectiveness * 100)}%)`;
}

export function getFatiguePreview(context: ForecastContext): string | null {
  if (context.mode === "batting") {
    if (context.approach === "patient") {
      const amount = GAME_CONSTANTS.PATIENT_FATIGUE.FATIGUE_EFFECT_PER_AT_BAT.toFixed(2);
      return `Patient adds +${amount} opp pitcher fatigue`;
    }
    if (context.approach === "power") {
      return "High variance: HR upside, elevated K risk";
    }
    if (context.approach === "contact") {
      return "Low variance: reliable contact, minimal big plays";
    }
  }

  if (context.mode === "pitching") {
    if (context.strategy === "paint") {
      const amount = GAME_CONSTANTS.PAINT_FATIGUE.FATIGUE_COST_PER_AT_BAT.toFixed(2);
      return `Paint costs +${amount} your pitcher fatigue`;
    }
    if (context.strategy === "challenge") {
      return "Power pitching: K ceiling, but HR danger if they connect";
    }
    if (context.strategy === "finesse") {
      return "Induces weak contact, limits extra-base hits";
    }
  }

  return null;
}

export function buildForecastSnapshot(
  context: ForecastContext,
  leverageContext?: LeverageContext
): ForecastSnapshot {
  return {
    riskTag: getRiskTag(context),
    tilt: getOutcomeTilt(context),
    adaptationWarning: getAdaptationWarning(context),
    fatiguePreview: getFatiguePreview(context),
    leverageLabel: leverageContext ? getLeverageLabel(leverageContext) : null,
  };
}
