import type { MatchResult, PlayByPlayEvent } from "@/types/game";

export type InsightTriggerType =
  | "scoring_swing"
  | "repeated_approach"
  | "repeated_strategy"
  | "ability_timing"
  | "late_turning_point"
  | "key_outcome";

export interface InsightCard {
  triggerType: InsightTriggerType;
  trigger: string;
  ripple: string;
  outcome: string;
  impactScore: number;
  inning: number;
  isTop: boolean;
}

interface CandidateInsight extends InsightCard {
  dedupeKey: string;
}

const MIN_IMPACT_THRESHOLD = 14;

function leverageBonus(inning: number, scoreDiffBefore: number): number {
  let bonus = 0;
  if (inning >= 7) bonus += 8;
  else if (inning >= 5) bonus += 4;

  if (Math.abs(scoreDiffBefore) <= 1) bonus += 8;
  else if (Math.abs(scoreDiffBefore) <= 3) bonus += 4;

  return bonus;
}

function outcomeLabel(outcome: PlayByPlayEvent["outcome"]): string {
  switch (outcome) {
    case "homerun":
      return "home run";
    case "triple":
      return "triple";
    case "double":
      return "double";
    case "single":
      return "single";
    case "walk":
      return "walk";
    case "strikeout":
      return "strikeout";
    default:
      return "key out";
  }
}

function getOutcomeImpact(outcome: PlayByPlayEvent["outcome"]): number {
  switch (outcome) {
    case "homerun":
      return 12;
    case "triple":
      return 9;
    case "double":
      return 7;
    case "single":
      return 5;
    case "walk":
      return 4;
    case "strikeout":
      return 6;
    case "groundout":
    case "flyout":
    case "lineout":
    case "popout":
      return 3;
    default:
      return 2;
  }
}

function pushCandidate(candidates: CandidateInsight[], candidate: CandidateInsight): void {
  candidates.push(candidate);
}

function createFallbackCard(match: MatchResult): InsightCard {
  const isLoss = !match.isWin;
  return {
    triggerType: "key_outcome",
    trigger: isLoss
      ? "Key turning point was low-confidence"
      : "Win came from distributed contributions",
    ripple: isLoss
      ? "This game had fewer high-signal decision events than usual"
      : "No single event dominated the result",
    outcome: isLoss
      ? "Use next match to test one strategic adjustment"
      : "Team maintained pressure across multiple innings",
    impactScore: 0,
    inning: match.totalInnings,
    isTop: false,
  };
}

export function generatePostMatchInsights(match: MatchResult): InsightCard[] {
  const playByPlay = match.playByPlay ?? [];
  if (playByPlay.length === 0) {
    return [createFallbackCard(match)];
  }

  const candidates: CandidateInsight[] = [];
  let myScore = 0;
  let opponentScore = 0;

  let lastApproach: string | null = null;
  let lastStrategy: string | null = null;
  let approachStreak = 0;
  let strategyStreak = 0;
  let lastHalfKey = "";

  for (const event of playByPlay) {
    const scoreDiffBefore = myScore - opponentScore;
    const halfKey = `${event.inning}-${event.isTop ? "T" : "B"}`;
    if (halfKey !== lastHalfKey) {
      lastHalfKey = halfKey;
      lastApproach = null;
      lastStrategy = null;
      approachStreak = 0;
      strategyStreak = 0;
    }

    const leverage = leverageBonus(event.inning, scoreDiffBefore);
    const runValue = event.rbi ?? 0;
    const baseImpact = runValue * 24 + getOutcomeImpact(event.outcome);

    if (event.batterApproach) {
      if (event.batterApproach === lastApproach) approachStreak += 1;
      else approachStreak = 1;
      lastApproach = event.batterApproach;

      if (approachStreak >= 2) {
        const impact = 10 + approachStreak * 4 + leverage;
        pushCandidate(candidates, {
          triggerType: "repeated_approach",
          trigger: `Repeated ${event.batterApproach} approach in inning ${event.inning}`,
          ripple: `Adaptation pressure rose to streak ${approachStreak}, reducing effective variation`,
          outcome: `At-bat resolved as ${outcomeLabel(event.outcome)}${runValue > 0 ? ` with ${runValue} RBI` : ""}`,
          impactScore: impact,
          inning: event.inning,
          isTop: event.isTop,
          dedupeKey: "repeated_approach",
        });
      }
    }

    if (event.pitchStrategy) {
      if (event.pitchStrategy === lastStrategy) strategyStreak += 1;
      else strategyStreak = 1;
      lastStrategy = event.pitchStrategy;

      if (strategyStreak >= 2) {
        const impact = 10 + strategyStreak * 4 + leverage;
        pushCandidate(candidates, {
          triggerType: "repeated_strategy",
          trigger: `Repeated ${event.pitchStrategy} strategy in inning ${event.inning}`,
          ripple: `Predictability increased at streak ${strategyStreak}, amplifying adaptation risk`,
          outcome: `Plate appearance ended in ${outcomeLabel(event.outcome)}`,
          impactScore: impact,
          inning: event.inning,
          isTop: event.isTop,
          dedupeKey: "repeated_strategy",
        });
      }
    }

    if (event.batterAbilityUsed || event.pitcherAbilityUsed) {
      const impact = 8 + baseImpact + leverage;
      pushCandidate(candidates, {
        triggerType: "ability_timing",
        trigger: "Ability activation in a leverage plate appearance",
        ripple: "Resource timing altered at-bat pressure and outcome odds",
        outcome: `Result became ${outcomeLabel(event.outcome)}${runValue > 0 ? ` for ${runValue} run(s)` : ""}`,
        impactScore: impact,
        inning: event.inning,
        isTop: event.isTop,
        dedupeKey: "ability_timing",
      });
    }

    if (runValue > 0) {
      const impact = baseImpact + leverage + 10;
      pushCandidate(candidates, {
        triggerType: "scoring_swing",
        trigger: `${runValue} run swing in inning ${event.inning}`,
        ripple: `Score pressure shifted by ${runValue} with leverage bonus ${leverage}`,
        outcome: `${outcomeLabel(event.outcome)} changed game state immediately`,
        impactScore: impact,
        inning: event.inning,
        isTop: event.isTop,
        dedupeKey: "scoring_swing",
      });
    } else if (event.inning >= 7 && (event.outs === 2 || event.outcome === "strikeout")) {
      const impact = baseImpact + leverage + 6;
      pushCandidate(candidates, {
        triggerType: "late_turning_point",
        trigger: `Late-inning ${outcomeLabel(event.outcome)} in inning ${event.inning}`,
        ripple: "High-leverage outs reduced comeback/insurance potential",
        outcome: "Run expectancy dropped in a critical game window",
        impactScore: impact,
        inning: event.inning,
        isTop: event.isTop,
        dedupeKey: "late_turning_point",
      });
    }

    if (event.isTop) opponentScore += runValue;
    else myScore += runValue;
  }

  const filtered = candidates
    .filter((candidate) => candidate.impactScore >= MIN_IMPACT_THRESHOLD)
    .sort((a, b) => b.impactScore - a.impactScore);

  const deduped: InsightCard[] = [];
  const seen = new Set<string>();

  for (const candidate of filtered) {
    if (seen.has(candidate.dedupeKey)) continue;
    seen.add(candidate.dedupeKey);
    deduped.push({
      triggerType: candidate.triggerType,
      trigger: candidate.trigger,
      ripple: candidate.ripple,
      outcome: candidate.outcome,
      impactScore: candidate.impactScore,
      inning: candidate.inning,
      isTop: candidate.isTop,
    });
    if (deduped.length >= 3) break;
  }

  if (deduped.length === 0) {
    return [createFallbackCard(match)];
  }

  if (deduped.length < 3) {
    deduped.push(createFallbackCard(match));
  }

  return deduped.slice(0, 3);
}
