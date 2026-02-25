import { describe, it, expect } from "vitest";
import { aiAutoRotate, calculateTeamStrength } from "../aiRotation";
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
      speed: rating,
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
  players: Player[],
  personality: AIPersonality
): OpponentTeam {
  return {
    id: "test-team",
    name: "Test Team",
    city: "Test",
    mascot: "Testers",
    tier: "SANDLOT",
    aiPersonality: personality,
    colors: { primary: "#000", secondary: "#fff" },
    roster: players,
    lineup: [],
    bench: [],
    cash: 5000,
    fans: 1.0,
    wins: 0,
    losses: 0,
  };
}

describe("aiRotation - AI Rotation Logic", () => {
  describe("aiAutoRotate - Basic Rotation", () => {
    it("should select best 9 batters for lineup", () => {
      const batters = [
        createMockBatter("b1", 80), // Elite
        createMockBatter("b2", 70),
        createMockBatter("b3", 60),
        createMockBatter("b4", 50),
        createMockBatter("b5", 40),
        createMockBatter("b6", 30),
        createMockBatter("b7", 20),
        createMockBatter("b8", 10),
        createMockBatter("b9", 5),
        createMockBatter("b10", 2), // Worst - should be benched
      ];

      const pitchers = [
        createMockPitcher("s1", "Starter", 50),
        createMockPitcher("r1", "Reliever", 50),
        createMockPitcher("r2", "Reliever", 50),
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const result = aiAutoRotate({
        team,
        matchImportance: 0.5,
        opponentStrength: 50,
      });

      // Top 9 batters should be in lineup
      expect(result.lineup).toContain("b1");
      expect(result.lineup).toContain("b9");
      expect(result.lineup).not.toContain("b10"); // Worst should be benched
      expect(result.bench).toContain("b10");
    });

    it("should select 1 starter and 2 relievers", () => {
      const batters = Array.from({ length: 9 }, (_, i) =>
        createMockBatter(`b${i}`, 50)
      );

      const pitchers = [
        createMockPitcher("s1", "Starter", 50),
        createMockPitcher("s2", "Starter", 40),
        createMockPitcher("r1", "Reliever", 50),
        createMockPitcher("r2", "Reliever", 45),
        createMockPitcher("r3", "Reliever", 40),
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const result = aiAutoRotate({
        team,
        matchImportance: 0.5,
        opponentStrength: 50,
      });

      // Should have exactly 12 players in lineup (9 batters + 1 starter + 2 relievers)
      expect(result.lineup).toHaveLength(12);

      // Best starter should be selected
      expect(result.lineup).toContain("s1");
      expect(result.bench).toContain("s2");

      // Best 2 relievers should be selected
      expect(result.lineup).toContain("r1");
      expect(result.lineup).toContain("r2");
      expect(result.bench).toContain("r3");
    });
  });

  describe("aiAutoRotate - AI Personality Effects", () => {
    it("should select best pitchers for lineup", () => {
      const batters = Array.from({ length: 9 }, (_, i) =>
        createMockBatter(`b${i}`, 50)
      );

      const pitchers = [
        createMockPitcher("s1", "Starter", 90), // Best starter
        createMockPitcher("s2", "Starter", 40), // Weaker starter
        createMockPitcher("r1", "Reliever", 60), // Best reliever
        createMockPitcher("r2", "Reliever", 55), // Second best reliever
        createMockPitcher("r3", "Reliever", 30), // Weak reliever
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const result = aiAutoRotate({
        team,
        matchImportance: 0.5,
        opponentStrength: 50,
      });

      // Should select best starter
      expect(result.lineup).toContain("s1");
      expect(result.bench).toContain("s2");

      // Should select best 2 relievers
      expect(result.lineup).toContain("r1");
      expect(result.lineup).toContain("r2");
      expect(result.bench).toContain("r3");
    });
  });

  describe("aiAutoRotate - Edge Cases", () => {
    it("should handle minimum roster", () => {
      const batters = Array.from({ length: 10 }, (_, i) =>
        createMockBatter(`b${i}`, 50)
      );

      const pitchers = [
        createMockPitcher("s1", "Starter", 50),
        createMockPitcher("r1", "Reliever", 50),
        createMockPitcher("r2", "Reliever", 50),
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const result = aiAutoRotate({
        team,
        matchImportance: 0.5,
        opponentStrength: 50,
      });

      // Should still field a complete team
      expect(result.lineup).toHaveLength(12);
      expect(result.lineup).toContain("s1"); // Best available starter
      expect(result.lineup).toContain("r1");
      expect(result.lineup).toContain("r2");
    });

    it("should handle only 2 relievers available", () => {
      const batters = Array.from({ length: 9 }, (_, i) =>
        createMockBatter(`b${i}`, 50)
      );

      const pitchers = [
        createMockPitcher("s1", "Starter", 50),
        createMockPitcher("r1", "Reliever", 50),
        createMockPitcher("r2", "Reliever", 50),
        // Only 2 relievers total
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const result = aiAutoRotate({
        team,
        matchImportance: 0.5,
        opponentStrength: 50,
      });

      // Should select both relievers
      expect(result.lineup).toContain("r1");
      expect(result.lineup).toContain("r2");
      expect(result.lineup).toHaveLength(12);
    });

    it("should handle minimum roster size", () => {
      const batters = Array.from({ length: 9 }, (_, i) =>
        createMockBatter(`b${i}`, 50)
      );

      const pitchers = [
        createMockPitcher("s1", "Starter", 50),
        createMockPitcher("r1", "Reliever", 50),
        createMockPitcher("r2", "Reliever", 50),
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const result = aiAutoRotate({
        team,
        matchImportance: 0.5,
        opponentStrength: 50,
      });

      // Exactly 12 in lineup, 0 on bench
      expect(result.lineup).toHaveLength(12);
      expect(result.bench).toHaveLength(0);
    });
  });

  describe("calculateTeamStrength", () => {
    it("should calculate average team strength from lineup", () => {
      const batters = [
        createMockBatter("b1", 80),
        createMockBatter("b2", 60),
        createMockBatter("b3", 40),
      ];

      const pitchers = [
        createMockPitcher("s1", "Starter", 60),
        createMockPitcher("r1", "Reliever", 50),
      ];

      const team = createMockTeam([...batters, ...pitchers], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      // Manually set lineup
      team.lineup = ["b1", "b2", "b3", "s1", "r1"];

      const strength = calculateTeamStrength(team);

      // Average: (80 + 60 + 40 + 60 + 50) / 5 = 58
      expect(strength).toBe(58);
    });

    it("should return 50 for empty lineup", () => {
      const team = createMockTeam([], {
        aggression: 0.5,
        depthFocus: 0.5,
        restDiscipline: 0.5,
      });

      const strength = calculateTeamStrength(team);
      expect(strength).toBe(50);
    });
  });
});
