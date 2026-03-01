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

  // Drama Score (0-100) — narrative shape metric
  // Components: lead changes weighted by inning (40), comeback win (20),
  //             clutch conversion rate (30), cliffhanger 9th+ (15)
  dramaScore: number;
  avgDramaScore: number; // per-game drama score average
}

/**
 * Analyze a single game for flow metrics, including Drama Score.
 */
function analyzeGameFlowSingle(game: GameStats): {
  leadChanges: number;
  isBlowout: boolean;
  isOneRunGame: boolean;
  isExtraInning: boolean;
  hasClutchMoment: boolean;
  isWalkOff: boolean;
  ABsPlayed: number;
  dramaScore: number;
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

  // ── True lead changes from inning-by-inning scores ────────────────────────
  // Walk through the running score after each inning pair and detect flips.
  // isTop: true = away bats; isTop: false = home bats.
  let leadChanges = 0;
  let weightedLeadChangePts = 0;
  let wasHomeAhead: boolean | null = null; // null = tied

  const { home: homeByInning, away: awayByInning } = game.inningScores;
  const totalInnPairs = Math.max(homeByInning.length, awayByInning.length);
  let cumulativeHome = 0;
  let cumulativeAway = 0;

  for (let i = 0; i < totalInnPairs; i++) {
    // Apply away half (top) then home half (bottom)
    cumulativeAway += awayByInning[i] ?? 0;
    cumulativeHome += homeByInning[i] ?? 0;

    const inningNumber = i + 1;
    const nowHomeAhead = cumulativeHome > cumulativeAway
      ? true
      : cumulativeAway > cumulativeHome
      ? false
      : null; // tied

    // Lead change = away had lead, now home does (or vice versa); ties don't count
    if (wasHomeAhead !== null && nowHomeAhead !== null && wasHomeAhead !== nowHomeAhead) {
      leadChanges++;
      // Weight by inning: late-inning lead changes are more dramatic
      weightedLeadChangePts += inningNumber / 9;
    }
    if (nowHomeAhead !== null) wasHomeAhead = nowHomeAhead;
  }

  // Fallback if inningScores are empty (shouldn't happen after simRunner update)
  if (totalInnPairs === 0) {
    leadChanges = isOneRunGame ? 1 : isBlowout ? 0 : 2;
    weightedLeadChangePts = leadChanges * 0.8; // rough middle-inning estimate
  }

  // ── Clutch moment heuristic ───────────────────────────────────────────────
  const hasClutchMoment = isOneRunGame || (isExtraInning && !isBlowout);

  // ── Walk-off heuristic ────────────────────────────────────────────────────
  // Extra inning game + 1-run margin = very likely walk-off
  const isWalkOff = isExtraInning && isOneRunGame;

  // ── Comeback win detection ────────────────────────────────────────────────
  // Did the eventual loser hold a lead at any inning, but the winner came back?
  let comebackWin = false;
  if (!isBlowout && (game.winner === "home" || game.winner === "away")) {
    let cHome2 = 0;
    let cAway2 = 0;
    const winnerIsHome = game.winner === "home";
    for (let i = 0; i < totalInnPairs; i++) {
      cAway2 += awayByInning[i] ?? 0;
      cHome2 += homeByInning[i] ?? 0;
      // If loser was ahead at any point mid-game (not after full game), it's a comeback
      const loserWasAhead = winnerIsHome ? cAway2 > cHome2 : cHome2 > cAway2;
      if (loserWasAhead && i < totalInnPairs - 1) {
        comebackWin = true;
        break;
      }
    }
  }

  // ── Cliffhanger ───────────────────────────────────────────────────────────
  // Fires for any 1-run game in regulation or longer (totalInnings >= 9).
  // This captures the drama of a tight finish, regardless of which inning the
  // winning run scored. In practice: regulation games end at inning 9, extra-inning
  // games extend beyond. So isCliffhanger = any close finish, not specifically 9th-inning drama.
  const isCliffhanger = game.totalInnings >= 9 && isOneRunGame;

  // ── Clutch conversion rate ────────────────────────────────────────────────
  const clutchRate = game.clutchABs > 0
    ? Math.min(game.clutchHits / game.clutchABs, 1)
    : 0.25; // fallback to league average ~.250

  // ── Drama Score (0–100) ───────────────────────────────────────────────────
  // Component 1: Weighted lead changes (cap at 40)
  const leadChangePts = Math.min(weightedLeadChangePts * 10, 40);
  // Component 2: Comeback win (+20)
  const comebackPts = comebackWin ? 20 : 0;
  // Component 3: Clutch conversion (* 30)
  const clutchPts = clutchRate * 30;
  // Component 4: Cliffhanger — decided in 9th+ (+15)
  const cliffhangerPts = isCliffhanger ? 15 : 0;

  const rawDrama = leadChangePts + comebackPts + clutchPts + cliffhangerPts;
  const dramaScore = Math.max(0, Math.min(100, rawDrama));

  return {
    leadChanges,
    isBlowout,
    isOneRunGame,
    isExtraInning,
    hasClutchMoment,
    isWalkOff,
    ABsPlayed: totalABs,
    dramaScore,
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
  let totalDramaScore = 0;

  for (const game of games) {
    const flow = analyzeGameFlowSingle(game);
    totalLeadChanges += flow.leadChanges;
    blowoutCount += flow.isBlowout ? 1 : 0;
    oneRunCount += flow.isOneRunGame ? 1 : 0;
    extraInningCount += flow.isExtraInning ? 1 : 0;
    walkOffCount += flow.isWalkOff ? 1 : 0;
    clutchCount += flow.hasClutchMoment ? 1 : 0;
    totalABs += flow.ABsPlayed;
    totalDramaScore += flow.dramaScore;
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

  // Drama Score (0–100): uncapped average clamped to scale
  // avgDramaScore can theoretically exceed 100 (maxed clutch + comeback + cliffhanger + lead changes),
  // so we cap it. Keep both values: avgDramaScore for diagnostics if components ever exceed bounds,
  // dramaScore for the canonical 0–100 scale.
  const avgDramaScore = games.length > 0 ? totalDramaScore / games.length : 0;
  const dramaScore = Math.max(0, Math.min(100, avgDramaScore));

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
    dramaScore,
    avgDramaScore,
  };
}
