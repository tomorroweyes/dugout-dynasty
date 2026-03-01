/**
 * Sim Harness - Core Simulation Runner
 *
 * Runs N headless games between two teams and aggregates stats.
 * Each game uses a different seed for variety.
 */

import type { Team } from "@/types/game";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import { simulateMatch } from "@/engine/matchEngine";

export interface GameStats {
  winner: "home" | "away" | "tie";
  homeRuns: number;
  awayRuns: number;
  homeHits: number;
  awayHits: number;
  homeKs: number;
  awayKs: number;
  homeBBs: number;
  awayBBs: number;
  homeHRs: number;
  awayHRs: number;
  totalInnings: number;
  // Approach/strategy distributions (from play-by-play)
  approaches: Record<BatterApproach, number>;
  strategies: Record<PitchStrategy, number>;
  // Outcomes
  outcomes: Record<string, number>;
  // Inning-by-inning run scoring (index = inning - 1; derived from play-by-play)
  // isTop: true = away bats; isTop: false = home bats
  inningScores: { home: number[]; away: number[] };
  // Clutch metrics: ABs and hits in innings 7+ with game within 2 runs
  clutchHits: number;
  clutchABs: number;
}

export interface AggregateStats {
  games: number;
  homeWins: number;
  awayWins: number;
  ties: number;
  avgHomeRuns: number;
  avgAwayRuns: number;
  avgRunDiff: number;
  avgInnings: number;
  // Rate stats
  homeKRate: number; // Ks / AB
  awayKRate: number;
  homeBBRate: number; // BBs / AB
  awayBBRate: number;
  homeHRRate: number; // HRs / AB
  awayHRRate: number;
  homeAvg: number; // hits / AB
  awayAvg: number;
  // Approach distributions (%)
  approachPct: Record<BatterApproach, number>;
  strategyPct: Record<PitchStrategy, number>;
  // Outcome distributions (%)
  outcomePct: Record<string, number>;
  // Raw totals for drill-down
  totalABs: number;
  rawGames: GameStats[];
}

/**
 * Simulate a single game and collect granular stats.
 */
function runOneGame(homeTeam: Team, awayTeam: Team): GameStats {
  const result = simulateMatch(homeTeam, awayTeam, false);

  // Aggregate batter stats
  const homeKs = result.boxScore.myBatters.reduce((s, b) => s + b.strikeouts, 0);
  const awayKs = result.boxScore.opponentBatters.reduce((s, b) => s + b.strikeouts, 0);
  const homeBBs = result.boxScore.myBatters.reduce((s, b) => s + b.walks, 0);
  const awayBBs = result.boxScore.opponentBatters.reduce((s, b) => s + b.walks, 0);
  const homeHRs = result.boxScore.myBatters.reduce((s, b) => s + (b.homeRuns ?? 0), 0);
  const awayHRs = result.boxScore.opponentBatters.reduce((s, b) => s + (b.homeRuns ?? 0), 0);
  const homeHits = result.boxScore.myHits;
  const awayHits = result.boxScore.opponentHits;

  // Collect approach/strategy distributions from play-by-play
  const approaches: Record<BatterApproach, number> = { power: 0, contact: 0, patient: 0 };
  const strategies: Record<PitchStrategy, number> = { challenge: 0, finesse: 0, paint: 0 };
  const outcomes: Record<string, number> = {};

  // Inning-by-inning run scoring derived from play-by-play.
  // isTop: true = away team batting (opponentTeam = awayTeam in simRunner)
  // isTop: false = home team batting (myTeam = homeTeam in simRunner)
  const maxInningIdx = result.totalInnings; // 1-based count
  const inningScores: { home: number[]; away: number[] } = {
    home: new Array(maxInningIdx).fill(0),
    away: new Array(maxInningIdx).fill(0),
  };

  // Clutch tracking: ABs/hits in innings 7+ when game is within 2 runs.
  // We track a running score so we can evaluate game state at each AB.
  let runningHome = 0;
  let runningAway = 0;
  let clutchHits = 0;
  let clutchABs = 0;
  const HIT_OUTCOMES = new Set(["single", "double", "triple", "homerun"]);
  // Non-AB outcomes (walks are not ABs in baseball)
  const NON_AB_OUTCOMES = new Set(["walk"]);

  // Sort plays by inning then isTop (away=top first, home=bottom second)
  // Play-by-play is already in order; process sequentially for running score
  let lastInning = 0;
  let lastIsTop = true;
  let inningHomeRuns = 0;
  let inningAwayRuns = 0;

  for (const play of result.playByPlay) {
    if (play.batterApproach) approaches[play.batterApproach]++;
    if (play.pitchStrategy) strategies[play.pitchStrategy]++;
    const key = play.outcome;
    outcomes[key] = (outcomes[key] ?? 0) + 1;

    // Track inning transitions to flush accumulated runs into inningScores
    const isNewHalf = play.inning !== lastInning || play.isTop !== lastIsTop;
    if (isNewHalf && lastInning > 0) {
      const idx = lastInning - 1;
      if (idx < inningScores.home.length) {
        if (lastIsTop) {
          // away bats top — flush to away
          inningScores.away[idx] += inningAwayRuns;
        } else {
          // home bats bottom — flush to home
          inningScores.home[idx] += inningHomeRuns;
        }
      }
      inningHomeRuns = 0;
      inningAwayRuns = 0;
    }
    lastInning = play.inning;
    lastIsTop = play.isTop;

    // Accumulate runs scored on this play
    const runs = play.rbi ?? 0;
    if (runs > 0) {
      if (play.isTop) {
        runningAway += runs;
        inningAwayRuns += runs;
      } else {
        runningHome += runs;
        inningHomeRuns += runs;
      }
    }

    // Clutch AB detection: inning 7+, game within 2 runs ENTERING this AB
    if (play.inning >= 7) {
      const diff = Math.abs(runningHome - runningAway);
      if (diff <= 2 && !NON_AB_OUTCOMES.has(play.outcome)) {
        clutchABs++;
        if (HIT_OUTCOMES.has(play.outcome)) {
          clutchHits++;
        }
      }
    }
  }

  // Flush the last half-inning
  if (lastInning > 0) {
    const idx = lastInning - 1;
    if (idx < inningScores.home.length) {
      if (lastIsTop) {
        inningScores.away[idx] += inningAwayRuns;
      } else {
        inningScores.home[idx] += inningHomeRuns;
      }
    }
  }

  const winner =
    result.myRuns > result.opponentRuns
      ? "home"
      : result.opponentRuns > result.myRuns
      ? "away"
      : "tie";

  return {
    winner,
    homeRuns: result.myRuns,
    awayRuns: result.opponentRuns,
    homeHits,
    awayHits,
    homeKs,
    awayKs,
    homeBBs,
    awayBBs,
    homeHRs,
    awayHRs,
    totalInnings: result.totalInnings,
    approaches,
    strategies,
    outcomes,
    inningScores,
    clutchHits,
    clutchABs,
  };
}

/**
 * Run N games between two teams and return aggregated stats.
 *
 * @param homeTeam - Home team
 * @param awayTeam - Away team
 * @param n - Number of games to simulate
 * @param onProgress - Optional callback every 100 games
 */
export function runSimulation(
  homeTeam: Team,
  awayTeam: Team,
  n: number,
  onProgress?: (pct: number) => void
): AggregateStats {
  const games: GameStats[] = [];

  for (let i = 0; i < n; i++) {
    games.push(runOneGame(homeTeam, awayTeam));
    if (onProgress && i % 100 === 0) onProgress(Math.round((i / n) * 100));
  }

  // Aggregate
  const homeWins = games.filter((g) => g.winner === "home").length;
  const awayWins = games.filter((g) => g.winner === "away").length;
  const ties = games.filter((g) => g.winner === "tie").length;

  const avgHomeRuns = avg(games.map((g) => g.homeRuns));
  const avgAwayRuns = avg(games.map((g) => g.awayRuns));
  const avgRunDiff = avg(games.map((g) => g.homeRuns - g.awayRuns));
  const avgInnings = avg(games.map((g) => g.totalInnings));

  // Count total ABs from outcomes (everything except walk is an AB)
  const totalOutcomes = sumRecord(games.map((g) => g.outcomes));
  const totalABs = Object.entries(totalOutcomes)
    .filter(([k]) => k !== "walk")
    .reduce((s, [, v]) => s + v, 0);

  const totalKs = games.reduce((s, g) => s + g.homeKs + g.awayKs, 0);
  const totalBBs = games.reduce((s, g) => s + g.homeBBs + g.awayBBs, 0);
  const totalHRs = games.reduce((s, g) => s + g.homeHRs + g.awayHRs, 0);
  const totalHits = games.reduce((s, g) => s + g.homeHits + g.awayHits, 0);

  const homeKs = games.reduce((s, g) => s + g.homeKs, 0);
  const awayKs = games.reduce((s, g) => s + g.awayKs, 0);
  const homeBBs = games.reduce((s, g) => s + g.homeBBs, 0);
  const awayBBs = games.reduce((s, g) => s + g.awayBBs, 0);
  const homeHRs = games.reduce((s, g) => s + g.homeHRs, 0);
  const awayHRs = games.reduce((s, g) => s + g.awayHRs, 0);
  const homeHits = games.reduce((s, g) => s + g.homeHits, 0);
  const awayHits = games.reduce((s, g) => s + g.awayHits, 0);

  // AB = outcomes - walks (rough per-team estimation)
  const homeABs = totalABs / 2;
  const awayABs = totalABs / 2;

  // Approach & strategy distributions
  const totalApproaches = sumRecord(games.map((g) => g.approaches));
  const totalStrategies = sumRecord(games.map((g) => g.strategies));

  const approachTotal = Object.values(totalApproaches).reduce((s, v) => s + v, 0);
  const stratTotal = Object.values(totalStrategies).reduce((s, v) => s + v, 0);

  return {
    games: n,
    homeWins,
    awayWins,
    ties,
    avgHomeRuns,
    avgAwayRuns,
    avgRunDiff,
    avgInnings,
    homeKRate: homeABs > 0 ? homeKs / homeABs : 0,
    awayKRate: awayABs > 0 ? awayKs / awayABs : 0,
    homeBBRate: homeABs > 0 ? homeBBs / homeABs : 0,
    awayBBRate: awayABs > 0 ? awayBBs / awayABs : 0,
    homeHRRate: homeABs > 0 ? homeHRs / homeABs : 0,
    awayHRRate: awayABs > 0 ? awayHRs / awayABs : 0,
    homeAvg: homeABs > 0 ? homeHits / homeABs : 0,
    awayAvg: awayABs > 0 ? awayHits / awayABs : 0,
    approachPct: {
      power: approachTotal > 0 ? totalApproaches.power / approachTotal : 0,
      contact: approachTotal > 0 ? totalApproaches.contact / approachTotal : 0,
      patient: approachTotal > 0 ? totalApproaches.patient / approachTotal : 0,
    },
    strategyPct: {
      challenge: stratTotal > 0 ? totalStrategies.challenge / stratTotal : 0,
      finesse: stratTotal > 0 ? totalStrategies.finesse / stratTotal : 0,
      paint: stratTotal > 0 ? totalStrategies.paint / stratTotal : 0,
    },
    outcomePct: Object.fromEntries(
      Object.entries(totalOutcomes).map(([k, v]) => [
        k,
        (v / (Object.values(totalOutcomes).reduce((s, x) => s + x, 0))) || 0,
      ])
    ),
    totalABs,
    rawGames: games,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function sumRecord(records: Record<string, number>[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const rec of records) {
    for (const [k, v] of Object.entries(rec)) {
      result[k] = (result[k] ?? 0) + v;
    }
  }
  return result;
}
