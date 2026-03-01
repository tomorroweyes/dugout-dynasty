/**
 * Season Arc Simulator
 *
 * Simulates a full N-game season across a set of archetype teams and measures
 * the retention-driving "hook" metrics described in issue #18.
 *
 * DESIGN
 *   - N teams, each playing gamesPerTeam games in a balanced round-robin
 *   - Standings tracked game-by-game for playoff race analysis
 *   - Hook metrics surface the season narrative quality
 *
 * USAGE (from harness.test.ts / season mode)
 *   import { runSeasonSimulation } from "./seasonSimulator";
 *   const result = runSeasonSimulation({ archetypes: [...], gamesPerTeam: 30 });
 *   printSeasonReport(result);
 *
 * METRIC TARGETS (per issue spec)
 *   80%+ of simulated seasons should produce ≥1 "must-play" moment.
 */

import type { Team } from "@/types/game";
import type { ArchetypeName } from "./teamFactory";
import { buildTeam } from "./teamFactory";
import { runSimulation } from "./simRunner";
import { analyzeGameFlow } from "./flowAnalyzer";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface SeasonTeamEntry {
  id: string;
  name: string;
  archetype: ArchetypeName;
  wins: number;
  losses: number;
  runsFor: number;
  runsAgainst: number;
  /** Win% = wins / (wins + losses) */
  winPct: number;
  /** Current streak: +N = win streak, -N = loss streak */
  currentStreak: number;
  /** Max consecutive wins achieved during the season */
  maxWinStreak: number;
  /** Max consecutive losses during the season */
  maxLossStreak: number;
  /** Full W/L history in chronological order */
  resultHistory: Array<"W" | "L">;
  /** Record after exactly 9 games (for comeback detection) */
  winsAtGame9: number;
  lossesAtGame9: number;
  /** Set true after final standings computed */
  madePlayoffs: boolean;
}

export interface SeasonGameResult {
  /** 0-based index in the full season schedule */
  gameIndex: number;
  homeTeamId: string;
  awayTeamId: string;
  homeRuns: number;
  awayRuns: number;
  winnerId: string;
  /** Drama Score 0-100 for this individual game */
  dramaScore: number;
  totalInnings: number;
  isExtraInnings: boolean;
  isOneRunGame: boolean;
}

export interface SeasonHookMetrics {
  /**
   * Playoff race tightness: fraction of the final 10 scheduled games whose
   * participants were within 2 wins of the last playoff spot entering the game.
   * 1.0 = every late game was meaningful; 0.0 = race was over early.
   */
  playoffRaceTightness: number;

  /**
   * Streak frequency: fraction of teams that hit a 5+ game win streak at
   * some point during the season.
   */
  streakFrequency: number;

  /**
   * Comeback rate: fraction of playoff teams that were sub-.400 after 9 games
   * (at most 3 wins in first 9 games).
   */
  comebackRate: number;

  /** True when any hook metric crosses its "must-play" threshold */
  hasMustPlayMoment: boolean;

  /** Human-readable season storylines, sorted by narrative weight */
  narrativeMoments: string[];

  /** Total games played in the season */
  totalGames: number;

  /** Average drama score across all games */
  avgDramaScore: number;

  /** Average drama score across final-10 games (late-season dramatics) */
  avgLateDramaScore: number;
}

export interface SeasonResult {
  /** All teams with final records */
  teams: SeasonTeamEntry[];
  /** All game results in schedule order */
  games: SeasonGameResult[];
  /** Teams sorted by wins desc, then run-diff as tiebreaker */
  finalStandings: SeasonTeamEntry[];
  /** Playoff-qualifying teams (top playoffSpots) */
  playoffTeams: SeasonTeamEntry[];
  /** Hook quality metrics */
  hookMetrics: SeasonHookMetrics;
}

export interface SeasonSimOptions {
  /** Archetype names for each team (default: all 6 built-ins) */
  archetypes?: ArchetypeName[];
  /** Games each team plays over the season (must be divisible by n-1) */
  gamesPerTeam?: number;
  /** How many teams make the playoffs */
  playoffSpots?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a balanced round-robin schedule.
 * Each pair of archetypes plays exactly gamesPerPair = gamesPerTeam / (n-1) times.
 * Series alternate home/away to prevent home-field bias from accumulating.
 *
 * The schedule is interleaved: one series-slot per pair per "wave", so late-season
 * games involve all pairs, not just leftover matchups.
 *
 * Example: 6 teams, 30 games/team → 6 series × 15 pairs = 90 games total.
 */
function buildSeasonSchedule(
  archetypes: ArchetypeName[],
  gamesPerTeam: number
): Array<[ArchetypeName, ArchetypeName]> {
  const n = archetypes.length;
  const gamesPerPair = Math.floor(gamesPerTeam / (n - 1));

  // All unique pairs
  const allPairs: [ArchetypeName, ArchetypeName][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allPairs.push([archetypes[i], archetypes[j]]);
    }
  }

  // Interleave: take one game from each pair per wave (like dealing cards)
  // Wave structure means early-season and late-season both involve all matchups.
  const schedule: Array<[ArchetypeName, ArchetypeName]> = [];
  for (let series = 0; series < gamesPerPair; series++) {
    for (const [a, b] of allPairs) {
      // Alternate home/away per series to balance home advantage
      if (series % 2 === 0) {
        schedule.push([a, b]);
      } else {
        schedule.push([b, a]);
      }
    }
  }

  return schedule;
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak helpers
// ─────────────────────────────────────────────────────────────────────────────

function updateStreak(entry: SeasonTeamEntry, result: "W" | "L"): void {
  if (result === "W") {
    entry.currentStreak = entry.currentStreak > 0 ? entry.currentStreak + 1 : 1;
    entry.maxWinStreak = Math.max(entry.maxWinStreak, entry.currentStreak);
  } else {
    entry.currentStreak = entry.currentStreak < 0 ? entry.currentStreak - 1 : -1;
    entry.maxLossStreak = Math.max(entry.maxLossStreak, Math.abs(entry.currentStreak));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Playoff race tightness: examine final `finalN` games in the schedule.
 * For each game, look at standings at that moment (games already played).
 * A game has "playoff implications" if at least one participant is within
 * 2 wins of the last playoff spot (could move in OR out with wins/losses).
 */
function computePlayoffRaceTightness(
  games: SeasonGameResult[],
  teams: SeasonTeamEntry[],
  playoffSpots: number,
  finalN: number
): number {
  const total = games.length;
  if (total === 0) return 0;

  const lastGames = games.slice(Math.max(0, total - finalN));
  if (lastGames.length === 0) return 0;

  // Build cumulative wins per team up to each game index
  // wins[teamId] = wins BEFORE game at that index
  const cumulativeWins = new Map<string, number>(
    teams.map((t) => [t.id, 0])
  );
  const winsByGameIndex = new Map<number, Map<string, number>>();

  for (const game of games) {
    // Snapshot standings BEFORE this game resolves
    winsByGameIndex.set(game.gameIndex, new Map(cumulativeWins));

    // Update after snapshot
    cumulativeWins.set(
      game.winnerId,
      (cumulativeWins.get(game.winnerId) ?? 0) + 1
    );
  }

  let raceGames = 0;
  for (const game of lastGames) {
    const snapshot = winsByGameIndex.get(game.gameIndex);
    if (!snapshot) continue;

    // Sort teams by wins at this moment
    const sorted = [...teams]
      .map((t) => ({ id: t.id, wins: snapshot.get(t.id) ?? 0 }))
      .sort((a, b) => b.wins - a.wins);

    // The cutoff: last-in wins count
    const cutoffIdx = Math.min(playoffSpots - 1, sorted.length - 1);
    const cutoffWins = sorted[cutoffIdx]?.wins ?? 0;

    const homeWins = snapshot.get(game.homeTeamId) ?? 0;
    const awayWins = snapshot.get(game.awayTeamId) ?? 0;

    const homeInRace = Math.abs(homeWins - cutoffWins) <= 2;
    const awayInRace = Math.abs(awayWins - cutoffWins) <= 2;

    if (homeInRace || awayInRace) raceGames++;
  }

  return raceGames / lastGames.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrative moment generator
// ─────────────────────────────────────────────────────────────────────────────

function generateNarrativeMoments(
  teams: SeasonTeamEntry[],
  finalStandings: SeasonTeamEntry[],
  games: SeasonGameResult[],
  playoffSpots: number,
  playoffRaceTightness: number
): string[] {
  const moments: string[] = [];

  // Comeback arcs
  for (const team of finalStandings.slice(0, playoffSpots)) {
    if (team.lossesAtGame9 > 0) {
      const earlyPct = team.winsAtGame9 / (team.winsAtGame9 + team.lossesAtGame9);
      if (earlyPct < 0.4 && team.winsAtGame9 + team.lossesAtGame9 === 9) {
        const finalPos = finalStandings.findIndex((t) => t.id === team.id) + 1;
        moments.push(
          `COMEBACK: ${team.name} started ${team.winsAtGame9}-${team.lossesAtGame9} but finished ` +
            `${team.wins}-${team.losses} (${finalPos}${ordinal(finalPos)} place, PLAYOFFS)`
        );
      }
    }
  }

  // Win streaks worthy of note (5+)
  const streakTeams = teams.filter((t) => t.maxWinStreak >= 5);
  for (const t of streakTeams) {
    moments.push(`STREAK: ${t.name} ripped off a ${t.maxWinStreak}-game winning streak`);
  }

  // Loss streaks (6+) — danger/story moments
  const lossStreakTeams = teams.filter((t) => t.maxLossStreak >= 6);
  for (const t of lossStreakTeams) {
    moments.push(`SLUMP: ${t.name} lost ${t.maxLossStreak} straight at one point`);
  }

  // Playoff race tightness
  if (playoffRaceTightness >= 0.7) {
    moments.push(
      `RACE: Playoff picture unsettled in ${Math.round(playoffRaceTightness * 100)}% of final-10 games`
    );
  }

  // High-drama late game
  const total = games.length;
  const lateGames = games.slice(Math.max(0, total - 10));
  const maxDramaLate = lateGames.reduce(
    (best, g) => (g.dramaScore > best.dramaScore ? g : best),
    lateGames[0]
  );
  if (maxDramaLate && maxDramaLate.dramaScore >= 80) {
    const homeName = teams.find((t) => t.id === maxDramaLate.homeTeamId)?.name ?? "?";
    const awayName = teams.find((t) => t.id === maxDramaLate.awayTeamId)?.name ?? "?";
    const inning = maxDramaLate.isExtraInnings
      ? ` (went ${maxDramaLate.totalInnings} innings)`
      : "";
    moments.push(
      `DRAMA: ${homeName} ${maxDramaLate.homeRuns}-${maxDramaLate.awayRuns} ${awayName}${inning} ` +
        `scored ${maxDramaLate.dramaScore.toFixed(0)} drama pts (late season)`
    );
  }

  // Dominant winner
  const champion = finalStandings[0];
  const runnerUp = finalStandings[1];
  if (champion && runnerUp) {
    const margin = champion.wins - runnerUp.wins;
    if (margin >= 6) {
      moments.push(
        `DOMINANT: ${champion.name} ran away with it — ${margin} games ahead of ${runnerUp.name}`
      );
    }
  }

  // Wire-to-wire close race (final 1-2 win separation among top N+1)
  if (finalStandings.length > playoffSpots) {
    const lastIn = finalStandings[playoffSpots - 1];
    const firstOut = finalStandings[playoffSpots];
    if (lastIn && firstOut && lastIn.wins - firstOut.wins <= 2) {
      moments.push(
        `PHOTO FINISH: ${lastIn.name} (in) edged ${firstOut.name} (out) by just ` +
          `${lastIn.wins - firstOut.wins} game${lastIn.wins - firstOut.wins !== 1 ? "s" : ""}`
      );
    }
  }

  return moments;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ARCHETYPES: ArchetypeName[] = [
  "POWER",
  "CONTACT",
  "BALANCED",
  "SPEED",
  "PITCHING",
  "SLUGFEST",
];

/**
 * Run a full N-game season simulation and return detailed results.
 *
 * @param options.archetypes  - Which archetypes to field (default: all 6)
 * @param options.gamesPerTeam - Games each team plays (default 30; must be
 *   divisible by archetypes.length - 1)
 * @param options.playoffSpots - How many teams make the playoffs (default 2)
 */
export function runSeasonSimulation(options: SeasonSimOptions = {}): SeasonResult {
  const archetypes = options.archetypes ?? DEFAULT_ARCHETYPES;
  const gamesPerTeam = options.gamesPerTeam ?? 30;
  const playoffSpots = options.playoffSpots ?? 2;

  if (archetypes.length < 2) {
    throw new Error("Season simulation requires at least 2 teams");
  }

  const n = archetypes.length;
  if (gamesPerTeam % (n - 1) !== 0) {
    throw new Error(
      `gamesPerTeam (${gamesPerTeam}) must be divisible by archetypes.length - 1 (${n - 1})`
    );
  }

  // Build one Team per archetype (different seeds for variety)
  const teamsMap = new Map<ArchetypeName, Team>();
  for (let i = 0; i < archetypes.length; i++) {
    teamsMap.set(archetypes[i], buildTeam(archetypes[i], 42 + i));
  }

  // Build team tracking entries
  const teamEntries = new Map<ArchetypeName, SeasonTeamEntry>();
  for (const arch of archetypes) {
    const team = teamsMap.get(arch)!;
    teamEntries.set(arch, {
      id: team.id ?? `team-${arch}`,
      name: arch,
      archetype: arch,
      wins: 0,
      losses: 0,
      runsFor: 0,
      runsAgainst: 0,
      winPct: 0,
      currentStreak: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      resultHistory: [],
      winsAtGame9: 0,
      lossesAtGame9: 0,
      madePlayoffs: false,
    });
  }

  // Generate schedule
  const schedule = buildSeasonSchedule(archetypes, gamesPerTeam);

  const allGameResults: SeasonGameResult[] = [];

  // Play all games in order
  for (let gameIndex = 0; gameIndex < schedule.length; gameIndex++) {
    const [homeArch, awayArch] = schedule[gameIndex];
    const homeEntry = teamEntries.get(homeArch)!;
    const awayEntry = teamEntries.get(awayArch)!;
    const homeTeam = teamsMap.get(homeArch)!;
    const awayTeam = teamsMap.get(awayArch)!;

    // Simulate 1 game (no trace, random RNG per game for variety)
    const aggStats = runSimulation(homeTeam, awayTeam, 1);
    const game = aggStats.rawGames[0];
    const flow = analyzeGameFlow(aggStats);

    const homeWon = game.homeRuns > game.awayRuns;
    const winnerId = homeWon ? homeEntry.id : awayEntry.id;

    // Update home record
    if (homeWon) {
      homeEntry.wins++;
    } else {
      homeEntry.losses++;
    }
    homeEntry.runsFor += game.homeRuns;
    homeEntry.runsAgainst += game.awayRuns;
    homeEntry.resultHistory.push(homeWon ? "W" : "L");
    updateStreak(homeEntry, homeWon ? "W" : "L");

    // Record at game 9 (capture early record for comeback detection)
    if (homeEntry.resultHistory.length === 9) {
      homeEntry.winsAtGame9 = homeEntry.wins;
      homeEntry.lossesAtGame9 = homeEntry.losses;
    }

    // Update away record
    if (!homeWon) {
      awayEntry.wins++;
    } else {
      awayEntry.losses++;
    }
    awayEntry.runsFor += game.awayRuns;
    awayEntry.runsAgainst += game.homeRuns;
    awayEntry.resultHistory.push(homeWon ? "L" : "W");
    updateStreak(awayEntry, homeWon ? "L" : "W");

    if (awayEntry.resultHistory.length === 9) {
      awayEntry.winsAtGame9 = awayEntry.wins;
      awayEntry.lossesAtGame9 = awayEntry.losses;
    }

    allGameResults.push({
      gameIndex,
      homeTeamId: homeEntry.id,
      awayTeamId: awayEntry.id,
      homeRuns: game.homeRuns,
      awayRuns: game.awayRuns,
      winnerId,
      dramaScore: flow.dramaScore,
      totalInnings: game.totalInnings,
      isExtraInnings: game.totalInnings > 9,
      isOneRunGame: Math.abs(game.homeRuns - game.awayRuns) === 1,
    });
  }

  // Final standings: wins desc, then run-diff tiebreaker
  const allTeams = [...teamEntries.values()];
  for (const t of allTeams) {
    t.winPct = t.wins + t.losses > 0 ? t.wins / (t.wins + t.losses) : 0;
  }
  const finalStandings = [...allTeams].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.runsFor - b.runsAgainst - (a.runsFor - a.runsAgainst)
  );

  const playoffTeams = finalStandings.slice(0, playoffSpots);
  for (const t of playoffTeams) {
    t.madePlayoffs = true;
  }

  // Hook metrics
  const playoffRaceTightness = computePlayoffRaceTightness(
    allGameResults,
    allTeams,
    playoffSpots,
    10
  );

  const streakFrequency =
    allTeams.length > 0
      ? allTeams.filter((t) => t.maxWinStreak >= 5).length / allTeams.length
      : 0;

  const comebackTeams = playoffTeams.filter(
    (t) =>
      t.winsAtGame9 + t.lossesAtGame9 === 9 &&
      t.winsAtGame9 / 9 < 0.4
  );
  const comebackRate =
    playoffTeams.length > 0 ? comebackTeams.length / playoffTeams.length : 0;

  const totalGames = allGameResults.length;
  const avgDramaScore =
    totalGames > 0
      ? allGameResults.reduce((s, g) => s + g.dramaScore, 0) / totalGames
      : 0;

  const lateGames = allGameResults.slice(Math.max(0, totalGames - 10));
  const avgLateDramaScore =
    lateGames.length > 0
      ? lateGames.reduce((s, g) => s + g.dramaScore, 0) / lateGames.length
      : 0;

  const narrativeMoments = generateNarrativeMoments(
    allTeams,
    finalStandings,
    allGameResults,
    playoffSpots,
    playoffRaceTightness
  );

  // Must-play moment: any strong hook fires
  const hasMustPlayMoment =
    playoffRaceTightness >= 0.6 ||
    streakFrequency >= 0.33 ||
    comebackRate > 0 ||
    narrativeMoments.length >= 2;

  const hookMetrics: SeasonHookMetrics = {
    playoffRaceTightness,
    streakFrequency,
    comebackRate,
    hasMustPlayMoment,
    narrativeMoments,
    totalGames,
    avgDramaScore,
    avgLateDramaScore,
  };

  return {
    teams: allTeams,
    games: allGameResults,
    finalStandings,
    playoffTeams,
    hookMetrics,
  };
}

/**
 * Simulate M seasons and aggregate hook metric averages.
 * Used to validate the "80%+ of seasons produce a must-play moment" target.
 */
export function runMultipleSeasons(
  count: number,
  options: SeasonSimOptions = {}
): {
  seasons: SeasonResult[];
  mustPlayRate: number;
  avgPlayoffRaceTightness: number;
  avgStreakFrequency: number;
  avgComebackRate: number;
  avgDramaScore: number;
} {
  const seasons: SeasonResult[] = [];
  for (let i = 0; i < count; i++) {
    seasons.push(runSeasonSimulation(options));
  }

  const mustPlayRate =
    seasons.filter((s) => s.hookMetrics.hasMustPlayMoment).length / count;
  const avgPlayoffRaceTightness =
    seasons.reduce((s, r) => s + r.hookMetrics.playoffRaceTightness, 0) / count;
  const avgStreakFrequency =
    seasons.reduce((s, r) => s + r.hookMetrics.streakFrequency, 0) / count;
  const avgComebackRate =
    seasons.reduce((s, r) => s + r.hookMetrics.comebackRate, 0) / count;
  const avgDramaScore =
    seasons.reduce((s, r) => s + r.hookMetrics.avgDramaScore, 0) / count;

  return {
    seasons,
    mustPlayRate,
    avgPlayoffRaceTightness,
    avgStreakFrequency,
    avgComebackRate,
    avgDramaScore,
  };
}
