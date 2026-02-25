import { describe, it, expect } from "vitest";
import { simulateAIMatch, calculateMatchImportance } from "../aiMatchSimulator";
import { OpponentTeam, AIPersonality } from "@/types/league";
import { Player } from "@/types/game";
import { GAME_CONSTANTS } from "../constants";

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

function createMockTeam(
  teamId: string,
  players: Player[],
  personality: AIPersonality
): OpponentTeam {
  // Set up initial lineup (first 9 batters, 1 starter, 2 relievers)
  const batters = players.filter((p) => p.role === "Batter");
  const starters = players.filter((p) => p.role === "Starter");
  const relievers = players.filter((p) => p.role === "Reliever");

  const lineup = [
    ...batters.slice(0, 9).map((p) => p.id),
    starters[0]?.id || "",
    ...relievers.slice(0, 2).map((p) => p.id),
  ].filter((id) => id !== "");

  const bench = players
    .filter((p) => !lineup.includes(p.id))
    .map((p) => p.id);

  return {
    id: teamId,
    name: `Team ${teamId}`,
    city: "Test",
    mascot: "Testers",
    tier: "SANDLOT",
    aiPersonality: personality,
    colors: { primary: "#000", secondary: "#fff" },
    roster: players,
    lineup,
    bench,
    cash: 5000,
    fans: 1.0,
    wins: 0,
    losses: 0,
  };
}

function createStandardPersonality(): AIPersonality {
  return {
    aggression: 0.5,
    depthFocus: 0.5,
    restDiscipline: 0.5,
  };
}

describe("aiMatchSimulator - AI Match Simulation", () => {
  describe("simulateAIMatch - Team Records", () => {
    it("should update win/loss records correctly", () => {
      const homePlayers = [
        ...Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`hb${i}`, 80)
        ), // Strong team
        createMockPitcher("hs1", "Starter", 80),
        createMockPitcher("hr1", "Reliever", 80),
        createMockPitcher("hr2", "Reliever", 80),
      ];

      const awayPlayers = [
        ...Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`ab${i}`, 30)
        ), // Weak team
        createMockPitcher("as1", "Starter", 30),
        createMockPitcher("ar1", "Reliever", 30),
        createMockPitcher("ar2", "Reliever", 30),
      ];

      const homeTeam = createMockTeam("home", homePlayers, createStandardPersonality());
      const awayTeam = createMockTeam("away", awayPlayers, createStandardPersonality());

      // Set initial records
      homeTeam.wins = 5;
      homeTeam.losses = 3;
      awayTeam.wins = 2;
      awayTeam.losses = 6;

      const {
        result,
        homeTeam: finalHome,
        awayTeam: finalAway,
      } = simulateAIMatch(homeTeam, awayTeam, 0.5);

      // One team should win, one should lose
      const totalWins = finalHome.wins + finalAway.wins;
      const totalLosses = finalHome.losses + finalAway.losses;

      expect(totalWins).toBe(5 + 2 + 1); // Initial wins + 1 new win
      expect(totalLosses).toBe(3 + 6 + 1); // Initial losses + 1 new loss

      // Winner should have incremented wins, loser should have incremented losses
      if (result.isWin) {
        // Home team won (from their perspective)
        expect(finalHome.wins).toBe(6);
        expect(finalHome.losses).toBe(3);
        expect(finalAway.wins).toBe(2);
        expect(finalAway.losses).toBe(7);
      } else {
        // Home team lost
        expect(finalHome.wins).toBe(5);
        expect(finalHome.losses).toBe(4);
        expect(finalAway.wins).toBe(3);
        expect(finalAway.losses).toBe(6);
      }
    });
  });

  describe("simulateAIMatch - Match Result", () => {
    it("should return a valid match result", () => {
      const homePlayers = [
        ...Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`hb${i}`, 60)
        ),
        createMockPitcher("hs1", "Starter", 60),
        createMockPitcher("hr1", "Reliever", 60),
        createMockPitcher("hr2", "Reliever", 60),
      ];

      const awayPlayers = [
        ...Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`ab${i}`, 60)
        ),
        createMockPitcher("as1", "Starter", 60),
        createMockPitcher("ar1", "Reliever", 60),
        createMockPitcher("ar2", "Reliever", 60),
      ];

      const homeTeam = createMockTeam("home", homePlayers, createStandardPersonality());
      const awayTeam = createMockTeam("away", awayPlayers, createStandardPersonality());

      const { result } = simulateAIMatch(homeTeam, awayTeam, 0.5);

      // Result should have valid properties
      expect(result).toBeDefined();
      expect(typeof result.isWin).toBe("boolean");
      expect(typeof result.myRuns).toBe("number");
      expect(typeof result.opponentRuns).toBe("number");
      expect(result.myRuns).toBeGreaterThanOrEqual(0);
      expect(result.opponentRuns).toBeGreaterThanOrEqual(0);

      // Winner should have more runs; loser has fewer or equal (ties count as loss)
      if (result.isWin) {
        expect(result.myRuns).toBeGreaterThan(result.opponentRuns);
      } else {
        expect(result.opponentRuns).toBeGreaterThanOrEqual(result.myRuns);
      }
    });
  });

  describe("calculateMatchImportance", () => {
    it("should increase importance as season progresses", () => {
      const earlyImportance = calculateMatchImportance(0, 10);
      const midImportance = calculateMatchImportance(5, 10);
      const lateImportance = calculateMatchImportance(9, 10);

      expect(earlyImportance).toBeLessThan(midImportance);
      expect(midImportance).toBeLessThan(lateImportance);
    });

    it("should return minimum 0.3 for early season", () => {
      const importance = calculateMatchImportance(0, 10);
      expect(importance).toBe(0.3);
    });

    it("should return 1.0 for final week", () => {
      const importance = calculateMatchImportance(10, 10);
      expect(importance).toBe(1.0);
    });

    it("should handle mid-season correctly", () => {
      const importance = calculateMatchImportance(5, 10);
      // Progress = 5/10 = 0.5
      // Importance = 0.3 + 0.5 * 0.7 = 0.65
      expect(importance).toBeCloseTo(0.65, 2);
    });
  });
});
