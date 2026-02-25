import { describe, it, expect } from "vitest";
import {
  calculateBatterXp,
  calculatePitcherXp,
  calculateMatchXp,
  applyXpToPlayer,
  getXpProgressPercent,
  getXpToNextLevel,
  isMaxLevel,
} from "../xpSystem";
import {
  calculateXpToNextLevel,
  BATTER_XP_REWARDS,
  PITCHER_XP_REWARDS,
  MATCH_XP_REWARDS,
  LEVEL_CONSTANTS,
} from "../xpConfig";
import type { Player, PlayerBoxScore, PitcherBoxScore } from "@/types/game";

describe("xpConfig", () => {
  describe("calculateXpToNextLevel", () => {
    it("should return 100 XP for level 1", () => {
      expect(calculateXpToNextLevel(1)).toBe(100);
    });

    it("should scale with level^1.5 formula", () => {
      // Level 5: 100 * 5^1.5 = 100 * 11.18 = 1118
      expect(calculateXpToNextLevel(5)).toBe(Math.floor(100 * Math.pow(5, 1.5)));

      // Level 10: 100 * 10^1.5 = 100 * 31.62 = 3162
      expect(calculateXpToNextLevel(10)).toBe(Math.floor(100 * Math.pow(10, 1.5)));
    });

    it("should require more XP at higher levels", () => {
      const level5Xp = calculateXpToNextLevel(5);
      const level10Xp = calculateXpToNextLevel(10);
      const level20Xp = calculateXpToNextLevel(20);

      expect(level10Xp).toBeGreaterThan(level5Xp);
      expect(level20Xp).toBeGreaterThan(level10Xp);
    });
  });
});

describe("xpSystem", () => {
  describe("calculateBatterXp", () => {
    it("should calculate XP for singles", () => {
      const boxScore: PlayerBoxScore = {
        playerId: "test-1",
        name: "Test Player",
        atBats: 4,
        hits: 2, // 2 singles
        runs: 0,
        rbis: 0,
        strikeouts: 0,
        walks: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
      };

      const xp = calculateBatterXp(boxScore);
      expect(xp).toBe(2 * BATTER_XP_REWARDS.SINGLE);
    });

    it("should calculate XP for extra-base hits", () => {
      const boxScore: PlayerBoxScore = {
        playerId: "test-1",
        name: "Test Player",
        atBats: 4,
        hits: 3, // 1 single, 1 double, 1 triple
        runs: 0,
        rbis: 0,
        strikeouts: 0,
        walks: 0,
        doubles: 1,
        triples: 1,
        homeRuns: 0,
      };

      const xp = calculateBatterXp(boxScore);
      const expected =
        1 * BATTER_XP_REWARDS.SINGLE +
        1 * BATTER_XP_REWARDS.DOUBLE +
        1 * BATTER_XP_REWARDS.TRIPLE;
      expect(xp).toBe(expected);
    });

    it("should calculate XP for home runs", () => {
      const boxScore: PlayerBoxScore = {
        playerId: "test-1",
        name: "Test Player",
        atBats: 4,
        hits: 1,
        runs: 1,
        rbis: 4, // Grand slam
        strikeouts: 0,
        walks: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 1,
      };

      const xp = calculateBatterXp(boxScore);
      const expected =
        BATTER_XP_REWARDS.HOME_RUN +
        BATTER_XP_REWARDS.RUN_SCORED +
        4 * BATTER_XP_REWARDS.RBI_BONUS;
      expect(xp).toBe(expected);
    });

    it("should calculate XP for walks", () => {
      const boxScore: PlayerBoxScore = {
        playerId: "test-1",
        name: "Test Player",
        atBats: 2,
        hits: 0,
        runs: 0,
        rbis: 0,
        strikeouts: 0,
        walks: 2,
      };

      const xp = calculateBatterXp(boxScore);
      expect(xp).toBe(2 * BATTER_XP_REWARDS.WALK);
    });

    it("should return 0 XP for strikeouts", () => {
      const boxScore: PlayerBoxScore = {
        playerId: "test-1",
        name: "Test Player",
        atBats: 4,
        hits: 0,
        runs: 0,
        rbis: 0,
        strikeouts: 4,
        walks: 0,
      };

      const xp = calculateBatterXp(boxScore);
      expect(xp).toBe(0);
    });
  });

  describe("calculatePitcherXp", () => {
    it("should calculate XP for innings pitched", () => {
      const boxScore: PitcherBoxScore = {
        playerId: "test-1",
        name: "Test Pitcher",
        inningsPitched: 5,
        hitsAllowed: 0,
        runsAllowed: 0,
        strikeouts: 0,
        walks: 0,
      };

      const xp = calculatePitcherXp(boxScore);
      expect(xp).toBe(5 * PITCHER_XP_REWARDS.INNING_PITCHED);
    });

    it("should add XP for strikeouts", () => {
      const boxScore: PitcherBoxScore = {
        playerId: "test-1",
        name: "Test Pitcher",
        inningsPitched: 3,
        hitsAllowed: 0,
        runsAllowed: 0,
        strikeouts: 6,
        walks: 0,
      };

      const xp = calculatePitcherXp(boxScore);
      const expected =
        3 * PITCHER_XP_REWARDS.INNING_PITCHED +
        6 * PITCHER_XP_REWARDS.STRIKEOUT;
      expect(xp).toBe(expected);
    });

    it("should apply penalties for walks and hits allowed", () => {
      const boxScore: PitcherBoxScore = {
        playerId: "test-1",
        name: "Test Pitcher",
        inningsPitched: 3,
        hitsAllowed: 4,
        runsAllowed: 2,
        strikeouts: 2,
        walks: 2,
      };

      const xp = calculatePitcherXp(boxScore);
      const expected =
        3 * PITCHER_XP_REWARDS.INNING_PITCHED +
        2 * PITCHER_XP_REWARDS.STRIKEOUT +
        2 * PITCHER_XP_REWARDS.WALK_PENALTY +
        4 * PITCHER_XP_REWARDS.HIT_ALLOWED_PENALTY +
        2 * PITCHER_XP_REWARDS.RUN_ALLOWED_PENALTY;
      expect(xp).toBe(Math.max(0, expected));
    });

    it("should not go below 0 XP", () => {
      const boxScore: PitcherBoxScore = {
        playerId: "test-1",
        name: "Test Pitcher",
        inningsPitched: 0.1, // Got only 1 out
        hitsAllowed: 10,
        runsAllowed: 8,
        strikeouts: 0,
        walks: 5,
        homeRunsAllowed: 3,
      };

      const xp = calculatePitcherXp(boxScore);
      expect(xp).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateMatchXp", () => {
    it("should add win bonus for wins", () => {
      const batterBoxScores: PlayerBoxScore[] = [
        {
          playerId: "batter-1",
          name: "Batter 1",
          atBats: 4,
          hits: 1,
          runs: 0,
          rbis: 0,
          strikeouts: 0,
          walks: 0,
        },
      ];
      const pitcherBoxScores: PitcherBoxScore[] = [];

      const xpGains = calculateMatchXp(
        batterBoxScores,
        pitcherBoxScores,
        true, // win
        ["batter-1"],
        []
      );

      expect(xpGains).toHaveLength(1);
      expect(xpGains[0].breakdown.fromMatchResult).toBe(MATCH_XP_REWARDS.WIN_BONUS);
    });

    it("should add consolation XP for losses", () => {
      const batterBoxScores: PlayerBoxScore[] = [
        {
          playerId: "batter-1",
          name: "Batter 1",
          atBats: 4,
          hits: 0,
          runs: 0,
          rbis: 0,
          strikeouts: 2,
          walks: 0,
        },
      ];

      const xpGains = calculateMatchXp(
        batterBoxScores,
        [],
        false, // loss
        ["batter-1"],
        []
      );

      expect(xpGains[0].breakdown.fromMatchResult).toBe(MATCH_XP_REWARDS.LOSS_CONSOLATION);
    });

    it("should add participation bonus for lineup players", () => {
      const batterBoxScores: PlayerBoxScore[] = [
        {
          playerId: "batter-1",
          name: "Batter 1",
          atBats: 4,
          hits: 0,
          runs: 0,
          rbis: 0,
          strikeouts: 0,
          walks: 0,
        },
      ];

      const xpGains = calculateMatchXp(
        batterBoxScores,
        [],
        true,
        ["batter-1"], // in lineup
        []
      );

      expect(xpGains[0].breakdown.fromParticipation).toBe(MATCH_XP_REWARDS.PARTICIPATION_BONUS);
    });

    it("should give reduced XP to bench players", () => {
      const xpGains = calculateMatchXp(
        [],
        [],
        true,
        [],
        ["bench-1"] // on bench
      );

      expect(xpGains).toHaveLength(1);
      const benchXp = xpGains[0].xpEarned;
      const expectedBenchXp = Math.floor(MATCH_XP_REWARDS.WIN_BONUS * MATCH_XP_REWARDS.BENCH_MULTIPLIER);
      expect(benchXp).toBe(expectedBenchXp);
    });
  });

  describe("applyXpToPlayer", () => {
    const createMockPlayer = (level: number, xp: number): Player => ({
      id: "test-1",
      name: "Test Player",
      role: "Batter",
      stats: { power: 50, contact: 50, glove: 50, speed: 50 },
      salary: 1000,
      level,
      xp,
      totalXpEarned: xp,
      equipment: {
        bat: null,
        glove: null,
        cap: null,
        cleats: null,
        accessory: null,
      },
    });

    it("should add XP without leveling up", () => {
      const player = createMockPlayer(1, 0);
      const { updatedPlayer, levelUps } = applyXpToPlayer(player, 50);

      expect(updatedPlayer.xp).toBe(50);
      expect(updatedPlayer.level).toBe(1);
      expect(updatedPlayer.totalXpEarned).toBe(50);
      expect(levelUps).toHaveLength(0);
    });

    it("should level up when XP threshold is reached", () => {
      const player = createMockPlayer(1, 50);
      // Need 100 XP for level 1→2
      const { updatedPlayer, levelUps } = applyXpToPlayer(player, 60);

      expect(updatedPlayer.level).toBe(2);
      expect(updatedPlayer.xp).toBe(10); // 50 + 60 - 100 = 10 overflow
      expect(updatedPlayer.totalXpEarned).toBe(110);
      expect(levelUps).toHaveLength(1);
      expect(levelUps[0].newLevel).toBe(2);
    });

    it("should handle multiple level-ups", () => {
      const player = createMockPlayer(1, 0);
      // Give enough XP to level multiple times
      // Level 1→2: 100, Level 2→3: ~283, total needed: ~383
      const { updatedPlayer, levelUps } = applyXpToPlayer(player, 500);

      expect(updatedPlayer.level).toBeGreaterThan(2);
      expect(levelUps.length).toBeGreaterThan(1);
    });

    it("should apply stat bonuses on level up", () => {
      const player = createMockPlayer(1, 99);
      const originalPower = (player.stats as any).power;

      const { updatedPlayer, levelUps } = applyXpToPlayer(player, 10);

      expect(levelUps).toHaveLength(1);
      // Batters get power, contact, glove bonuses
      expect((updatedPlayer.stats as any).power).toBeGreaterThan(originalPower);
    });

    it("should not exceed max level", () => {
      const player = createMockPlayer(LEVEL_CONSTANTS.MAX_LEVEL - 1, 0);
      const xpNeeded = calculateXpToNextLevel(LEVEL_CONSTANTS.MAX_LEVEL - 1);

      const { updatedPlayer } = applyXpToPlayer(player, xpNeeded + 10000);

      expect(updatedPlayer.level).toBe(LEVEL_CONSTANTS.MAX_LEVEL);
    });
  });

  describe("utility functions", () => {
    const createMockPlayer = (level: number, xp: number): Player => ({
      id: "test-1",
      name: "Test Player",
      role: "Batter",
      stats: { power: 50, contact: 50, glove: 50, speed: 50 },
      salary: 1000,
      level,
      xp,
      totalXpEarned: xp,
      equipment: {
        bat: null,
        glove: null,
        cap: null,
        cleats: null,
        accessory: null,
      },
    });

    describe("getXpProgressPercent", () => {
      it("should return 0 for no XP", () => {
        const player = createMockPlayer(1, 0);
        expect(getXpProgressPercent(player)).toBe(0);
      });

      it("should return 50 for halfway progress", () => {
        const player = createMockPlayer(1, 50); // 50/100 = 50%
        expect(getXpProgressPercent(player)).toBe(50);
      });

      it("should return 100 for max level", () => {
        const player = createMockPlayer(LEVEL_CONSTANTS.MAX_LEVEL, 0);
        expect(getXpProgressPercent(player)).toBe(100);
      });
    });

    describe("getXpToNextLevel", () => {
      it("should return correct XP for level 1", () => {
        const player = createMockPlayer(1, 0);
        expect(getXpToNextLevel(player)).toBe(100);
      });
    });

    describe("isMaxLevel", () => {
      it("should return false for level 1", () => {
        const player = createMockPlayer(1, 0);
        expect(isMaxLevel(player)).toBe(false);
      });

      it("should return true for max level", () => {
        const player = createMockPlayer(LEVEL_CONSTANTS.MAX_LEVEL, 0);
        expect(isMaxLevel(player)).toBe(true);
      });
    });
  });
});
