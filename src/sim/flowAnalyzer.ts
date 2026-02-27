/**
 * Game Flow Analyzer - Measure "fun" metrics
 *
 * Tracks pacing, variance, clutch moments, and excitement indicators.
 * These are orthogonal to balance — a game can be balanced but boring.
 */

import type { AggregateStats } from "./simRunner";
import type { GameStats } from "./simRunner";

export interface FlowMetrics {
  // Pacing
  avgRunsHome: number;
  avgRunsAway: number;
  avgRunsPerSide: number;
  avgGameLength: number; // avg total inning pairs
  avgABsPerGame: number;

  // Variance (excitement)
  avgLeadChanges: number;
  blowoutRate: number; // % games with >5 run diff
  oneRunGameRate: number; // games decided by 1 run
  extraInningRate: number;
  walkOffRate: number; // games won in last AB of game

  // Clutch moments (rough estimate from runs scored timing)
  clutchMomentRate: number; // games with run in inning 7+

  // Composite fun score (0-100)
  funScore: number;
}

/**
 * Analyze a single game for flow metrics
 */
function analyzeGameFlowSingle(game: GameStats): {
  leadChanges: number;
  isBlowout: boolean;
  isOneRunGame: boolean;
  isExtraInning: boolean;
  hasClutchMoment: boolean;
  isWalkOff: boolean;
  ABsPlayed: number;
} {
  const isBlowout = Math.abs(game.homeRuns - game.awayRuns) > 5;
  const isOneRunGame = Math.abs(game.homeRuns - game.awayRuns) === 1;
  const isExtraInning = game.totalInnings > 9;

  // Rough estimate: count outcome events as ABs
  const totalABs = Object.values({
    strikeouts: game.homeKs + game.awayKs,
    walks: game.homeBBs + game.awayBBs,
    hits: game.homeHits + game.awayHits,
  }).reduce((s, v) => s + v, 0);

  // Lead changes: guess based on run distribution
  // (real lead changes would need inning-by-inning data)
  const leadChanges = isOneRunGame ? 1 : isBlowout ? 0 : 2;

  // Clutch moment: game decided by a run in late inning
  // We'd need play-by-play timing, so use heuristic: close game + late inning
  const hasClutchMoment = isOneRunGame || (isExtraInning && !isBlowout);

  // Walk-off: game ends in bottom 9+  and winning team won on last play
  // Estimate: isExtraInning and isOneRunGame
  const isWalkOff = isExtraInning && Math.abs(game.homeRuns - game.awayRuns) === 1;

  return {
    leadChanges,
    isBlowout,
    isOneRunGame,
    isExtraInning,
    hasClutchMoment,
    isWalkOff,
    ABsPlayed: totalABs,
  };
}

/**
 * Compute fun metrics from a set of games
 */
export function analyzeGameFlow(stats: AggregateStats): FlowMetrics {
  const games = stats.rawGames;

  let totalLeadChanges = 0;
  let blowoutCount = 0;
  let oneRunCount = 0;
  let extraInningCount = 0;
  let walkOffCount = 0;
  let clutchCount = 0;
  let totalABs = 0;

  for (const game of games) {
    const flow = analyzeGameFlowSingle(game);
    totalLeadChanges += flow.leadChanges;
    blowoutCount += flow.isBlowout ? 1 : 0;
    oneRunCount += flow.isOneRunGame ? 1 : 0;
    extraInningCount += flow.isExtraInning ? 1 : 0;
    walkOffCount += flow.isWalkOff ? 1 : 0;
    clutchCount += flow.hasClutchMoment ? 1 : 0;
    totalABs += flow.ABsPlayed;
  }

  const avgRunsHome = stats.avgHomeRuns;
  const avgRunsAway = stats.avgAwayRuns;
  const avgRunsPerSide = (avgRunsHome + avgRunsAway) / 2;
  const avgGameLength = stats.avgInnings;
  const avgABsPerGame = totalABs / games.length;

  const avgLeadChanges = totalLeadChanges / games.length;
  const blowoutRate = blowoutCount / games.length;
  const oneRunGameRate = oneRunCount / games.length;
  const extraInningRate = extraInningCount / games.length;
  const walkOffRate = walkOffCount / games.length;
  const clutchMomentRate = clutchCount / games.length;

  // Compute fun score (0-100)
  // Higher is better for: pacing (4-5 runs/side), variance (lead changes), clutch (walk-offs)
  // Lower is better for: blowouts
  let funScore = 50; // baseline

  // Pacing: ideal ~4 runs/side
  const pacingDelta = Math.abs(avgRunsPerSide - 4);
  if (pacingDelta < 1) funScore += 15;
  else if (pacingDelta < 2) funScore += 10;
  else funScore -= 10;

  // Variance: more lead changes = more exciting
  if (avgLeadChanges >= 2) funScore += 15;
  else if (avgLeadChanges >= 1.5) funScore += 10;
  else funScore -= 5;

  // Avoid blowouts
  if (blowoutRate < 0.15) funScore += 10;
  else if (blowoutRate < 0.25) funScore += 5;
  else funScore -= 10;

  // Clutch moments (walk-offs)
  if (walkOffRate >= 0.02) funScore += 10;
  if (clutchMomentRate >= 0.25) funScore += 8;

  // One-run games (exciting finishes)
  if (oneRunGameRate >= 0.15) funScore += 8;
  else if (oneRunGameRate >= 0.10) funScore += 4;

  // Extra innings (good for variety, but rare is OK)
  if (extraInningRate >= 0.02 && extraInningRate <= 0.08) funScore += 5;

  funScore = Math.max(0, Math.min(100, funScore));

  return {
    avgRunsHome,
    avgRunsAway,
    avgRunsPerSide,
    avgGameLength,
    avgABsPerGame,
    avgLeadChanges,
    blowoutRate,
    oneRunGameRate,
    extraInningRate,
    walkOffRate,
    clutchMomentRate,
    funScore,
  };
}
