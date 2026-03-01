/**
 * Season Arc Simulator — Unit Tests
 *
 * Verifies:
 *   - Season produces correct number of games per team
 *   - Playoff race tightness is computed without error
 *   - Hook metrics fire appropriately
 *   - runMultipleSeasons aggregates correctly
 *   - Must-play rate meets the 80% target across N simulated seasons
 */

import { describe, it, expect } from "vitest";
import {
  runSeasonSimulation,
  runMultipleSeasons,
  type SeasonResult,
} from "./seasonSimulator";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Run a minimal 2-team, 6-game season for fast structural checks */
function tinySeasonResult(): SeasonResult {
  return runSeasonSimulation({
    archetypes: ["POWER", "CONTACT"],
    gamesPerTeam: 6,
    playoffSpots: 1,
  });
}

/** Run a standard 6-team, 30-game season */
function standardSeasonResult(): SeasonResult {
  return runSeasonSimulation({
    gamesPerTeam: 30,
    playoffSpots: 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("runSeasonSimulation — schedule correctness", () => {
  it("each team plays exactly gamesPerTeam games", () => {
    const result = tinySeasonResult();
    for (const team of result.teams) {
      expect(team.wins + team.losses).toBe(6);
    }
  });

  it("gamesPerTeam respected for 6-team season", () => {
    const result = standardSeasonResult();
    for (const team of result.teams) {
      expect(team.wins + team.losses).toBe(30);
    }
  });

  it("total games = (n * gamesPerTeam) / 2", () => {
    const result = standardSeasonResult();
    // 6 teams × 30 games / 2 = 90
    expect(result.games.length).toBe(90);
  });

  it("total games for 2-team season", () => {
    const result = tinySeasonResult();
    // 2 teams × 6 games / 2 = 6
    expect(result.games.length).toBe(6);
  });

  it("every game result has valid participants", () => {
    const result = standardSeasonResult();
    const teamIds = new Set(result.teams.map((t) => t.id));
    for (const game of result.games) {
      expect(teamIds.has(game.homeTeamId)).toBe(true);
      expect(teamIds.has(game.awayTeamId)).toBe(true);
      expect(game.homeTeamId).not.toBe(game.awayTeamId);
    }
  });

  it("winner is always home or away team id", () => {
    const result = tinySeasonResult();
    for (const game of result.games) {
      expect([game.homeTeamId, game.awayTeamId]).toContain(game.winnerId);
    }
  });

  it("runs are always non-negative", () => {
    const result = standardSeasonResult();
    for (const game of result.games) {
      expect(game.homeRuns).toBeGreaterThanOrEqual(0);
      expect(game.awayRuns).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Standings correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("runSeasonSimulation — standings", () => {
  it("total wins across all teams equals total games", () => {
    const result = standardSeasonResult();
    const totalWins = result.teams.reduce((s, t) => s + t.wins, 0);
    expect(totalWins).toBe(result.games.length);
  });

  it("total losses equals total wins (one per game)", () => {
    const result = standardSeasonResult();
    const totalWins = result.teams.reduce((s, t) => s + t.wins, 0);
    const totalLosses = result.teams.reduce((s, t) => s + t.losses, 0);
    expect(totalWins).toBe(totalLosses);
  });

  it("finalStandings sorted by wins descending", () => {
    const result = standardSeasonResult();
    for (let i = 0; i < result.finalStandings.length - 1; i++) {
      expect(result.finalStandings[i].wins).toBeGreaterThanOrEqual(
        result.finalStandings[i + 1].wins
      );
    }
  });

  it("playoff count matches playoffSpots", () => {
    const result = standardSeasonResult();
    const playoffCount = result.teams.filter((t) => t.madePlayoffs).length;
    expect(playoffCount).toBe(2);
  });

  it("playoff teams are the top teams by wins", () => {
    const result = standardSeasonResult();
    const [first, second] = result.finalStandings;
    expect(first.madePlayoffs).toBe(true);
    expect(second.madePlayoffs).toBe(true);
  });

  it("win% is correctly derived from wins and losses", () => {
    const result = standardSeasonResult();
    for (const team of result.teams) {
      const expected = team.wins / (team.wins + team.losses);
      expect(team.winPct).toBeCloseTo(expected, 5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hook metrics
// ─────────────────────────────────────────────────────────────────────────────

describe("runSeasonSimulation — hook metrics", () => {
  it("playoffRaceTightness is 0-1", () => {
    const result = standardSeasonResult();
    expect(result.hookMetrics.playoffRaceTightness).toBeGreaterThanOrEqual(0);
    expect(result.hookMetrics.playoffRaceTightness).toBeLessThanOrEqual(1);
  });

  it("streakFrequency is 0-1", () => {
    const result = standardSeasonResult();
    expect(result.hookMetrics.streakFrequency).toBeGreaterThanOrEqual(0);
    expect(result.hookMetrics.streakFrequency).toBeLessThanOrEqual(1);
  });

  it("comebackRate is 0-1", () => {
    const result = standardSeasonResult();
    expect(result.hookMetrics.comebackRate).toBeGreaterThanOrEqual(0);
    expect(result.hookMetrics.comebackRate).toBeLessThanOrEqual(1);
  });

  it("avgDramaScore is 0-100", () => {
    const result = standardSeasonResult();
    expect(result.hookMetrics.avgDramaScore).toBeGreaterThanOrEqual(0);
    expect(result.hookMetrics.avgDramaScore).toBeLessThanOrEqual(100);
  });

  it("narrativeMoments is an array", () => {
    const result = standardSeasonResult();
    expect(Array.isArray(result.hookMetrics.narrativeMoments)).toBe(true);
  });

  it("totalGames matches actual game count", () => {
    const result = standardSeasonResult();
    expect(result.hookMetrics.totalGames).toBe(result.games.length);
  });

  it("hasMustPlayMoment is boolean", () => {
    const result = standardSeasonResult();
    expect(typeof result.hookMetrics.hasMustPlayMoment).toBe("boolean");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Streak tracking
// ─────────────────────────────────────────────────────────────────────────────

describe("runSeasonSimulation — streak tracking", () => {
  it("maxWinStreak is ≥ 0 for all teams", () => {
    const result = standardSeasonResult();
    for (const team of result.teams) {
      expect(team.maxWinStreak).toBeGreaterThanOrEqual(0);
    }
  });

  it("maxLossStreak is ≥ 0 for all teams", () => {
    const result = standardSeasonResult();
    for (const team of result.teams) {
      expect(team.maxLossStreak).toBeGreaterThanOrEqual(0);
    }
  });

  it("result history length matches games played", () => {
    const result = standardSeasonResult();
    for (const team of result.teams) {
      expect(team.resultHistory.length).toBe(30);
    }
  });

  it("result history contains only W and L", () => {
    const result = standardSeasonResult();
    for (const team of result.teams) {
      for (const r of team.resultHistory) {
        expect(["W", "L"]).toContain(r);
      }
    }
  });

  it("streakFrequency correctly reflects 5+ win streaks", () => {
    const result = standardSeasonResult();
    const actualFraction =
      result.teams.filter((t) => t.maxWinStreak >= 5).length /
      result.teams.length;
    expect(result.hookMetrics.streakFrequency).toBeCloseTo(actualFraction, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-season aggregation
// ─────────────────────────────────────────────────────────────────────────────

describe("runMultipleSeasons", () => {
  it("returns the requested number of seasons", () => {
    const multi = runMultipleSeasons(3, { gamesPerTeam: 30, playoffSpots: 2 });
    expect(multi.seasons.length).toBe(3);
  });

  it("mustPlayRate is 0-1", () => {
    const multi = runMultipleSeasons(3, { gamesPerTeam: 30, playoffSpots: 2 });
    expect(multi.mustPlayRate).toBeGreaterThanOrEqual(0);
    expect(multi.mustPlayRate).toBeLessThanOrEqual(1);
  });

  it("avgPlayoffRaceTightness is 0-1", () => {
    const multi = runMultipleSeasons(3, { gamesPerTeam: 30, playoffSpots: 2 });
    expect(multi.avgPlayoffRaceTightness).toBeGreaterThanOrEqual(0);
    expect(multi.avgPlayoffRaceTightness).toBeLessThanOrEqual(1);
  });

  it("avgDramaScore is 0-100", () => {
    const multi = runMultipleSeasons(3, { gamesPerTeam: 30, playoffSpots: 2 });
    expect(multi.avgDramaScore).toBeGreaterThanOrEqual(0);
    expect(multi.avgDramaScore).toBeLessThanOrEqual(100);
  });

  it("mustPlayRate is consistently above 80% target across 10 seasons", () => {
    // This is the key #18 success criteria
    const multi = runMultipleSeasons(10, { gamesPerTeam: 30, playoffSpots: 2 });
    // >= 80% of seasons must have a must-play moment
    expect(multi.mustPlayRate).toBeGreaterThanOrEqual(0.8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

describe("runSeasonSimulation — input validation", () => {
  it("throws with fewer than 2 teams", () => {
    expect(() =>
      runSeasonSimulation({ archetypes: ["POWER"], gamesPerTeam: 10 })
    ).toThrow("at least 2 teams");
  });

  it("throws when gamesPerTeam is not divisible by (n-1)", () => {
    // 3 teams, 7 games: 7 % 2 = 1 (not divisible)
    expect(() =>
      runSeasonSimulation({
        archetypes: ["POWER", "CONTACT", "BALANCED"],
        gamesPerTeam: 7,
      })
    ).toThrow("must be divisible");
  });

  it("accepts valid 4-team, 12-game season (12 / 3 = 4)", () => {
    expect(() =>
      runSeasonSimulation({
        archetypes: ["POWER", "CONTACT", "BALANCED", "SPEED"],
        gamesPerTeam: 12,
        playoffSpots: 2,
      })
    ).not.toThrow();
  });
});
