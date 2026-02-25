import { describe, it, expect, beforeEach } from "vitest";
import { leagueController } from "../LeagueController";
import { League, OpponentTeam } from "@/types/league";
import { Player, Team } from "@/types/game";
import { GAME_CONSTANTS } from "@/engine/constants";

/**
 * Test utilities for creating mock players and teams
 */
function createMockBatter(
  id: string,
  rating: number
): Player {
  return {
    id,
    name: `Batter ${id}`,
    role: "Batter",
    stats: {
      power: rating,
      contact: rating,
      glove: rating,
    },
    salary: 100000,
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    equipment: {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
  };
}

function createMockPitcher(
  id: string,
  role: "Starter" | "Reliever",
  rating: number
): Player {
  return {
    id,
    name: `Pitcher ${id}`,
    role,
    stats: {
      velocity: rating,
      control: rating,
      break: rating,
    },
    salary: 100000,
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    equipment: {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
  };
}

function createStandardRoster(teamId: string): Player[] {
  return [
    ...Array.from({ length: 9 }, (_, i) =>
      createMockBatter(`${teamId}-b${i}`, 60)
    ),
    createMockPitcher(`${teamId}-s1`, "Starter", 60),
    createMockPitcher(`${teamId}-r1`, "Reliever", 60),
    createMockPitcher(`${teamId}-r2`, "Reliever", 60),
  ];
}

function createMockOpponentTeam(teamId: string, rating: number): OpponentTeam {
  const roster = createStandardRoster(teamId);

  // Set initial lineup
  const batters = roster.filter((p) => p.role === "Batter");
  const starters = roster.filter((p) => p.role === "Starter");
  const relievers = roster.filter((p) => p.role === "Reliever");

  const lineup = [
    ...batters.slice(0, 9).map((p) => p.id),
    starters[0].id,
    ...relievers.slice(0, 2).map((p) => p.id),
  ];

  const bench = roster.filter((p) => !lineup.includes(p.id)).map((p) => p.id);

  return {
    id: teamId,
    name: `Team ${teamId}`,
    city: `City ${teamId}`,
    mascot: `Mascot ${teamId}`,
    tier: "SANDLOT",
    aiPersonality: {
      aggression: 0.5,
      depthFocus: 0.5,
      restDiscipline: 0.5,
    },
    colors: { primary: "#000", secondary: "#fff" },
    roster,
    lineup,
    bench,
    cash: 5000,
    fans: 1.0,
    wins: 0,
    losses: 0,
  };
}

function createMockHumanTeam(): Team {
  const roster = createStandardRoster("human");
  const batters = roster.filter((p) => p.role === "Batter");
  const starters = roster.filter((p) => p.role === "Starter");
  const relievers = roster.filter((p) => p.role === "Reliever");

  const lineup = [
    ...batters.slice(0, 9).map((p) => p.id),
    starters[0].id,
    ...relievers.slice(0, 2).map((p) => p.id),
  ];

  const bench = roster.filter((p) => !lineup.includes(p.id)).map((p) => p.id);

  return {
    id: "human-team",
    roster,
    lineup,
    bench,
    cash: 5000,
    fans: 1.0,
    wins: 0,
    losses: 0,
  };
}

describe("LeagueController - Week Simulation", () => {
  describe("completeWeek - AI Match Simulation", () => {
    it("should simulate all AI vs AI matches", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Mark human match as complete
      const currentWeek = league.schedule.weeks[0];
      const humanMatch = currentWeek.matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );
      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = {
          isWin: true,
          myRuns: 5,
          opponentRuns: 3,
          cashEarned: 100,
          totalInnings: 9,
          playByPlay: [],
        };
      }

      const updatedLeague = leagueController.completeWeek(league);

      // All matches should be completed
      const allMatches = updatedLeague.schedule.weeks[0].matches;
      expect(allMatches.every((m) => m.completed)).toBe(true);

      // Each match should have a result
      allMatches.forEach((match) => {
        expect(match.result).toBeDefined();
        expect(match.result?.myRuns).toBeGreaterThanOrEqual(0);
        expect(match.result?.opponentRuns).toBeGreaterThanOrEqual(0);
      });
    });

    it("should not simulate human match again if already completed", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Complete human match with specific score
      const currentWeek = league.schedule.weeks[0];
      const humanMatch = currentWeek.matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );

      const originalResult = {
        isWin: true,
        myRuns: 10,
        opponentRuns: 1,
        cashEarned: 200,
        totalInnings: 9,
        playByPlay: [],
      };

      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = originalResult;
      }

      const updatedLeague = leagueController.completeWeek(league);

      // Find human match in updated league
      const updatedHumanMatch = updatedLeague.schedule.weeks[0].matches.find(
        (m) =>
          m.homeTeamId === updatedLeague.humanTeamId ||
          m.awayTeamId === updatedLeague.humanTeamId
      );

      // Result should be unchanged
      expect(updatedHumanMatch?.result).toEqual(originalResult);
    });

    it("should skip incomplete human match", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Don't complete human match
      const updatedLeague = leagueController.completeWeek(league);

      const humanMatch = updatedLeague.schedule.weeks[0].matches.find(
        (m) =>
          m.homeTeamId === updatedLeague.humanTeamId ||
          m.awayTeamId === updatedLeague.humanTeamId
      );

      // Human match should still be incomplete
      expect(humanMatch?.completed).toBe(false);
      expect(humanMatch?.result).toBeUndefined();

      // But other matches should be complete
      const aiMatches = updatedLeague.schedule.weeks[0].matches.filter(
        (m) =>
          m.homeTeamId !== updatedLeague.humanTeamId &&
          m.awayTeamId !== updatedLeague.humanTeamId
      );

      aiMatches.forEach((match) => {
        expect(match.completed).toBe(true);
        expect(match.result).toBeDefined();
      });
    });
  });

  describe("completeWeek - Standings Updates", () => {
    it("should update standings after week", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Find and complete human match
      const humanMatch = league.schedule.weeks[0].matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );
      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = {
          isWin: true,
          myRuns: 5,
          opponentRuns: 3,
          cashEarned: 100,
          totalInnings: 9,
          playByPlay: [],
        };

        // Update team records (simulating what gameStore does)
        const humanTeamInLeague = league.teams.find((t) => t.id === league.humanTeamId);
        const opponentId = humanMatch.homeTeamId === league.humanTeamId
          ? humanMatch.awayTeamId
          : humanMatch.homeTeamId;
        const opponentTeam = league.teams.find((t) => t.id === opponentId);

        if (humanTeamInLeague) {
          humanTeamInLeague.wins = 1;
          humanTeamInLeague.losses = 0;
        }
        if (opponentTeam) {
          opponentTeam.wins = 0;
          opponentTeam.losses = 1;
        }
      }

      const updatedLeague = leagueController.completeWeek(league);

      // Standings should reflect wins and losses
      const totalWins = updatedLeague.standings.reduce(
        (sum, s) => sum + s.wins,
        0
      );
      const totalLosses = updatedLeague.standings.reduce(
        (sum, s) => sum + s.losses,
        0
      );

      // In a 4-team league with 2 matches, there should be 2 wins and 2 losses
      const numMatches = updatedLeague.schedule.weeks[0].matches.length;
      expect(totalWins).toBe(numMatches);
      expect(totalLosses).toBe(numMatches);
    });

    it("should sort standings by wins", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Complete human match as a win
      const humanMatch = league.schedule.weeks[0].matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );
      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = {
          isWin: true,
          myRuns: 10,
          opponentRuns: 0,
          cashEarned: 100,
          totalInnings: 9,
          playByPlay: [],
        };
      }

      const updatedLeague = leagueController.completeWeek(league);

      // Standings should be sorted by wins descending
      for (let i = 0; i < updatedLeague.standings.length - 1; i++) {
        expect(updatedLeague.standings[i].wins).toBeGreaterThanOrEqual(
          updatedLeague.standings[i + 1].wins
        );
      }
    });
  });

  describe("completeWeek - Week Advancement", () => {
    it("should advance to next week", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      expect(league.currentWeek).toBe(0);

      // Complete human match
      const humanMatch = league.schedule.weeks[0].matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );
      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = {
          isWin: true,
          myRuns: 5,
          opponentRuns: 3,
          cashEarned: 100,
          totalInnings: 9,
          playByPlay: [],
        };
      }

      const updatedLeague = leagueController.completeWeek(league);

      expect(updatedLeague.currentWeek).toBe(1);
    });

    it("should complete season on final week", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Advance to final week
      league.currentWeek = league.totalWeeks - 1;

      // Complete human match
      const humanMatch =
        league.schedule.weeks[league.currentWeek].matches.find(
          (m) =>
            m.homeTeamId === league.humanTeamId ||
            m.awayTeamId === league.humanTeamId
        );
      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = {
          isWin: true,
          myRuns: 5,
          opponentRuns: 3,
          cashEarned: 100,
          totalInnings: 9,
          playByPlay: [],
        };
      }

      const updatedLeague = leagueController.completeWeek(league);

      expect(updatedLeague.isComplete).toBe(true);
      expect(updatedLeague.seasonResult).toBeDefined();
    });
  });

  describe("completeWeek - Team Win/Loss Tracking", () => {
    it("should update team wins and losses", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Get initial wins/losses
      const initialWins = league.teams.reduce((sum, t) => sum + t.wins, 0);
      const initialLosses = league.teams.reduce((sum, t) => sum + t.losses, 0);

      // Find and complete human match
      const humanMatch = league.schedule.weeks[0].matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );
      if (humanMatch) {
        humanMatch.completed = true;
        humanMatch.result = {
          isWin: true,
          myRuns: 5,
          opponentRuns: 3,
          cashEarned: 100,
          totalInnings: 9,
          playByPlay: [],
        };

        // Update team records (simulating what gameStore does)
        const humanTeamInLeague = league.teams.find((t) => t.id === league.humanTeamId);
        const opponentId = humanMatch.homeTeamId === league.humanTeamId
          ? humanMatch.awayTeamId
          : humanMatch.homeTeamId;
        const opponentTeam = league.teams.find((t) => t.id === opponentId);

        if (humanTeamInLeague) {
          humanTeamInLeague.wins = 1;
          humanTeamInLeague.losses = 0;
        }
        if (opponentTeam) {
          opponentTeam.wins = 0;
          opponentTeam.losses = 1;
        }
      }

      const updatedLeague = leagueController.completeWeek(league);

      // Total wins should increase by number of matches
      const finalWins = updatedLeague.teams.reduce((sum, t) => sum + t.wins, 0);
      const finalLosses = updatedLeague.teams.reduce(
        (sum, t) => sum + t.losses,
        0
      );

      const numMatches = league.schedule.weeks[0].matches.length;
      expect(finalWins).toBe(initialWins + numMatches);
      expect(finalLosses).toBe(initialLosses + numMatches);
    });
  });

  describe("completeSeason - Season Results", () => {
    it("should calculate promotion for top finishers", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("SANDLOT", humanTeam, 1);

      // Force human team to win all matches
      league.teams.forEach((team) => {
        if (team.id === league.humanTeamId) {
          team.wins = 10;
          team.losses = 0;
        } else {
          team.wins = 0;
          team.losses = 10;
        }
      });

      const completedLeague = leagueController.completeSeason(league);

      expect(completedLeague.seasonResult?.promoted).toBe(true);
      expect(completedLeague.seasonResult?.nextTier).toBe("LOCAL");
    });

    it("should calculate relegation for bottom finishers", () => {
      const humanTeam = createMockHumanTeam();
      const league = leagueController.startNewSeason("LOCAL", humanTeam, 1); // Start in higher tier

      // Force human team to lose all matches
      league.teams.forEach((team) => {
        if (team.id === league.humanTeamId) {
          team.wins = 0;
          team.losses = 10;
        } else {
          team.wins = 10;
          team.losses = 0;
        }
      });

      const completedLeague = leagueController.completeSeason(league);

      expect(completedLeague.seasonResult?.relegated).toBe(true);
      expect(completedLeague.seasonResult?.nextTier).toBe("SANDLOT");
    });
  });
});
