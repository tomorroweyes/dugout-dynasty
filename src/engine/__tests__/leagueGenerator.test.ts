import { describe, it, expect } from "vitest";
import {
  generateOpponentTeam,
  generateLeague,
  generateSeasonSchedule,
  calculateStandings,
} from "../leagueGenerator";
import { GAME_CONSTANTS } from "../constants";
import { Team } from "@/types/game";

describe("League Generator", () => {
  describe("generateOpponentTeam", () => {
    it("should generate a valid opponent team for SANDLOT tier", () => {
      const team = generateOpponentTeam("SANDLOT");

      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
      expect(team.city).toBeDefined();
      expect(team.mascot).toBeDefined();
      expect(team.tier).toBe("SANDLOT");
      // SANDLOT tier: 4 batters + 1 starter + 0 relievers = 5 total (minimum real lineup)
      expect(team.roster).toHaveLength(5);
      // Lineup: 9 batting positions (cycled through 4 batters) + 1 starter + 0 relievers = 10
      expect(team.lineup).toHaveLength(10);
      expect(team.aiPersonality).toBeDefined();
      expect(team.colors).toBeDefined();
    });

    it("should generate teams with varying strength in tier range", () => {
      const teams = Array.from({ length: 10 }, () =>
        generateOpponentTeam("REGIONAL")
      );

      // Check that teams have different strengths (not all identical)
      const uniqueNames = new Set(teams.map((t) => t.name));
      expect(uniqueNames.size).toBeGreaterThan(1);

      // Check that teams are in correct tier
      teams.forEach((team) => {
        expect(team.tier).toBe("REGIONAL");
      });
    });
  });

  describe("generateSeasonSchedule", () => {
    it("should create round-robin schedule for 4 teams", () => {
      const teams = Array.from({ length: 4 }, () =>
        generateOpponentTeam("SANDLOT")
      );

      const schedule = generateSeasonSchedule(teams, 2); // 2 games per opponent

      // With 4 teams, each plays 3 opponents, 2 times = 6 games total
      // 2 matches per week (4 teams / 2) = 3 weeks per round × 2 rounds = 6 weeks
      expect(schedule.weeks.length).toBe(6);

      // Each week should have 2 matches
      schedule.weeks.forEach((week) => {
        expect(week.matches.length).toBe(2);
      });

      // Verify each team plays the correct number of games
      const teamIds = teams.map((t) => t.id);
      const gamesPerTeam = new Map<string, number>();
      teamIds.forEach((id) => gamesPerTeam.set(id, 0));

      schedule.weeks.forEach((week) => {
        week.matches.forEach((match) => {
          gamesPerTeam.set(
            match.homeTeamId,
            (gamesPerTeam.get(match.homeTeamId) || 0) + 1
          );
          gamesPerTeam.set(
            match.awayTeamId,
            (gamesPerTeam.get(match.awayTeamId) || 0) + 1
          );
        });
      });

      // Each team should play 6 games (3 opponents × 2 games)
      teamIds.forEach((id) => {
        expect(gamesPerTeam.get(id)).toBe(6);
      });
    });

    it("should handle odd number of teams with bye week", () => {
      const teams = Array.from({ length: 5 }, () =>
        generateOpponentTeam("LOCAL")
      );

      const schedule = generateSeasonSchedule(teams, 2);

      // With 5 teams, one team has bye each week
      // Each week should have 2 matches (4 teams playing, 1 on bye)
      schedule.weeks.forEach((week) => {
        expect(week.matches.length).toBe(2);
      });
    });
  });

  describe("generateLeague", () => {
    it("should generate a complete league with human team", () => {
      // Create a mock human team
      const humanTeam: Team = {
        id: "human-team",
        cash: 5000,
        fans: 1.0,
        roster: [],
        lineup: [],
        bench: [],
        wins: 0,
        losses: 0,
      };

      const league = generateLeague("SANDLOT", humanTeam, 1);

      expect(league.id).toBeDefined();
      expect(league.tier).toBe("SANDLOT");
      expect(league.season).toBe(1);
      expect(league.teams).toHaveLength(4); // SANDLOT has 4 teams
      expect(league.humanTeamId).toBeDefined();
      expect(league.schedule).toBeDefined();
      expect(league.standings).toHaveLength(4);
      expect(league.currentWeek).toBe(0);
      expect(league.isComplete).toBe(false);
    });

    it("should generate correct number of teams per tier", () => {
      const humanTeam: Team = {
        id: "human-team",
        cash: 5000,
        fans: 1.0,
        roster: [],
        lineup: [],
        bench: [],
        wins: 0,
        losses: 0,
      };

      const sandlotLeague = generateLeague("SANDLOT", humanTeam, 1);
      expect(sandlotLeague.teams).toHaveLength(
        GAME_CONSTANTS.LEAGUE_TIERS.SANDLOT.numTeams
      );

      const localLeague = generateLeague("LOCAL", humanTeam, 1);
      expect(localLeague.teams).toHaveLength(
        GAME_CONSTANTS.LEAGUE_TIERS.LOCAL.numTeams
      );

      const worldLeague = generateLeague("WORLD", humanTeam, 1);
      expect(worldLeague.teams).toHaveLength(
        GAME_CONSTANTS.LEAGUE_TIERS.WORLD.numTeams
      );
    });
  });

  describe("calculateStandings", () => {
    it("should sort teams by wins", () => {
      const teams = [
        { ...generateOpponentTeam("SANDLOT"), wins: 3, losses: 2 },
        { ...generateOpponentTeam("SANDLOT"), wins: 5, losses: 0 },
        { ...generateOpponentTeam("SANDLOT"), wins: 1, losses: 4 },
      ];

      const standings = calculateStandings(teams);

      expect(standings[0].wins).toBe(5); // Best team first
      expect(standings[1].wins).toBe(3);
      expect(standings[2].wins).toBe(1); // Worst team last
    });

    it("should use win percentage for tiebreakers", () => {
      const teams = [
        { ...generateOpponentTeam("SANDLOT"), wins: 2, losses: 1 }, // 2/3 = 0.667
        { ...generateOpponentTeam("SANDLOT"), wins: 2, losses: 2 }, // 2/4 = 0.500
        { ...generateOpponentTeam("SANDLOT"), wins: 2, losses: 0 }, // 2/2 = 1.000
      ];

      const standings = calculateStandings(teams);

      expect(standings[0].wins).toBe(2);
      expect(standings[0].losses).toBe(0); // Best win percentage
      expect(standings[2].losses).toBe(2); // Worst win percentage
    });
  });
});
