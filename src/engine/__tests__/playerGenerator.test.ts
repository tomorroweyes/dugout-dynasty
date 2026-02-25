import { describe, it, expect } from "vitest";
import {
  generatePlayer,
  generateStarterTeam,
  generateTeamByTier,
} from "../playerGenerator";
import { SeededRandomProvider } from "../randomProvider";
import { isBatter, isPitcher } from "@/types/game";
import { GAME_CONSTANTS } from "../constants";

describe("playerGenerator", () => {
  describe("generatePlayer", () => {
    it("should generate a batter with correct structure", () => {
      const rng = new SeededRandomProvider(12345);
      const batter = generatePlayer("Batter", "AVERAGE", rng);

      expect(batter).toHaveProperty("id");
      expect(batter).toHaveProperty("name");
      expect(batter.role).toBe("Batter");
      expect(batter).toHaveProperty("stats");
      expect(batter.stats).toHaveProperty("power");
      expect(batter.stats).toHaveProperty("contact");
      expect(batter.stats).toHaveProperty("glove");
      expect(batter).toHaveProperty("salary");
      expect(batter.salary).toBeGreaterThan(0);
    });

    it("should generate a pitcher with correct structure", () => {
      const rng = new SeededRandomProvider(12345);
      const pitcher = generatePlayer("Starter", "AVERAGE", rng);

      expect(pitcher).toHaveProperty("id");
      expect(pitcher).toHaveProperty("name");
      expect(pitcher.role).toBe("Starter");
      expect(pitcher).toHaveProperty("stats");
      expect(pitcher.stats).toHaveProperty("velocity");
      expect(pitcher.stats).toHaveProperty("control");
      expect(pitcher.stats).toHaveProperty("break");
      expect(pitcher).toHaveProperty("salary");
    });

    it("should generate reliever with correct role", () => {
      const rng = new SeededRandomProvider(12345);
      const reliever = generatePlayer("Reliever", "AVERAGE", rng);

      expect(reliever.role).toBe("Reliever");
      expect(isPitcher(reliever)).toBe(true);
    });

    it("should respect quality tiers for batters", () => {
      const rng = new SeededRandomProvider(12345);

      const rookie = generatePlayer("Batter", "ROOKIE", rng);
      const elite = generatePlayer(
        "Batter",
        "ELITE",
        new SeededRandomProvider(12345)
      );

      expect(isBatter(rookie)).toBe(true);
      expect(isBatter(elite)).toBe(true);

      if (isBatter(rookie) && isBatter(elite)) {
        // Elite should generally have better stats
        const rookieTotal =
          rookie.stats.power + rookie.stats.contact + rookie.stats.glove;
        const eliteTotal =
          elite.stats.power + elite.stats.contact + elite.stats.glove;

        expect(eliteTotal).toBeGreaterThan(rookieTotal);

        // Elite should have higher salary
        expect(elite.salary).toBeGreaterThan(rookie.salary);
      }
    });

    it("should respect quality tiers for pitchers", () => {
      const rng = new SeededRandomProvider(12345);

      const rookie = generatePlayer("Starter", "ROOKIE", rng);
      const elite = generatePlayer(
        "Starter",
        "ELITE",
        new SeededRandomProvider(12345)
      );

      expect(isPitcher(rookie)).toBe(true);
      expect(isPitcher(elite)).toBe(true);

      if (isPitcher(rookie) && isPitcher(elite)) {
        const rookieTotal =
          rookie.stats.velocity + rookie.stats.control + rookie.stats.break;
        const eliteTotal =
          elite.stats.velocity + elite.stats.control + elite.stats.break;

        expect(eliteTotal).toBeGreaterThan(rookieTotal);
        expect(elite.salary).toBeGreaterThan(rookie.salary);
      }
    });

    it("should generate deterministic players with same seed", () => {
      const player1 = generatePlayer(
        "Batter",
        "AVERAGE",
        new SeededRandomProvider(42)
      );
      const player2 = generatePlayer(
        "Batter",
        "AVERAGE",
        new SeededRandomProvider(42)
      );

      expect(player1.stats).toEqual(player2.stats);
      expect(player1.salary).toEqual(player2.salary);
      // Note: ID and name will be different due to Date.now() and faker
    });

    it("should clamp stats to valid ranges", () => {
      // Generate many players and check all stats are in valid range
      for (let i = 0; i < 50; i++) {
        const batter = generatePlayer(
          "Batter",
          "ELITE",
          new SeededRandomProvider(i)
        );
        if (isBatter(batter)) {
          expect(batter.stats.power).toBeGreaterThanOrEqual(0);
          expect(batter.stats.power).toBeLessThanOrEqual(100);
          expect(batter.stats.contact).toBeGreaterThanOrEqual(0);
          expect(batter.stats.contact).toBeLessThanOrEqual(100);
          expect(batter.stats.glove).toBeGreaterThanOrEqual(0);
          expect(batter.stats.glove).toBeLessThanOrEqual(100);
        }

        const pitcher = generatePlayer(
          "Starter",
          "ELITE",
          new SeededRandomProvider(i + 100)
        );
        if (isPitcher(pitcher)) {
          expect(pitcher.stats.velocity).toBeGreaterThanOrEqual(0);
          expect(pitcher.stats.velocity).toBeLessThanOrEqual(100);
          expect(pitcher.stats.control).toBeGreaterThanOrEqual(0);
          expect(pitcher.stats.control).toBeLessThanOrEqual(100);
          expect(pitcher.stats.break).toBeGreaterThanOrEqual(0);
          expect(pitcher.stats.break).toBeLessThanOrEqual(100);
        }
      }
    });

    it("should calculate appropriate salaries based on quality", () => {
      const rookie = generatePlayer(
        "Batter",
        "ROOKIE",
        new SeededRandomProvider(42)
      );
      const average = generatePlayer(
        "Batter",
        "AVERAGE",
        new SeededRandomProvider(42)
      );
      const star = generatePlayer(
        "Batter",
        "STAR",
        new SeededRandomProvider(42)
      );
      const elite = generatePlayer(
        "Batter",
        "ELITE",
        new SeededRandomProvider(42)
      );

      // Salaries should generally increase with quality
      expect(average.salary).toBeGreaterThanOrEqual(rookie.salary);
      expect(star.salary).toBeGreaterThan(average.salary);
      expect(elite.salary).toBeGreaterThan(star.salary);
    });
  });

  describe("generateStarterTeam", () => {
    it("should generate correct number of players", () => {
      const rng = new SeededRandomProvider(12345);
      const team = generateStarterTeam(rng);

      const batters = team.filter(isBatter);
      const starters = team.filter((p) => isPitcher(p) && p.role === "Starter");
      const relievers = team.filter(
        (p) => isPitcher(p) && p.role === "Reliever"
      );

      expect(batters.length).toBe(GAME_CONSTANTS.STARTER_ROSTER.BATTERS);
      expect(starters.length).toBe(GAME_CONSTANTS.STARTER_ROSTER.STARTERS);
      expect(relievers.length).toBe(GAME_CONSTANTS.STARTER_ROSTER.RELIEVERS);
      expect(team.length).toBe(
        GAME_CONSTANTS.STARTER_ROSTER.BATTERS +
          GAME_CONSTANTS.STARTER_ROSTER.STARTERS +
          GAME_CONSTANTS.STARTER_ROSTER.RELIEVERS
      );
    });

    it("should generate team with mixed quality distribution", () => {
      const rng = new SeededRandomProvider(12345);
      const team = generateStarterTeam(rng);
      const batters = team.filter(isBatter);

      // Calculate average stats
      const avgPower =
        batters.reduce((sum, b) => sum + (b.stats as any).power, 0) /
        batters.length;
      const avgContact =
        batters.reduce((sum, b) => sum + (b.stats as any).contact, 0) /
        batters.length;

      // With mixed quality, averages should be in middle range
      expect(avgPower).toBeGreaterThan(35);
      expect(avgPower).toBeLessThan(75);
      expect(avgContact).toBeGreaterThan(35);
      expect(avgContact).toBeLessThan(75);
    });

    it("should generate team with some star players", () => {
      const rng = new SeededRandomProvider(12345);
      const team = generateStarterTeam(rng);
      const batters = team.filter(isBatter);

      // Check if we have at least one high-quality batter
      const maxPower = Math.max(...batters.map((b) => (b.stats as any).power));
      const maxContact = Math.max(
        ...batters.map((b) => (b.stats as any).contact)
      );

      // Should have at least one stat above 60 (STAR/GOOD range)
      expect(Math.max(maxPower, maxContact)).toBeGreaterThan(60);
    });

    it("should be deterministic with same seed", () => {
      const team1 = generateStarterTeam(new SeededRandomProvider(42));
      const team2 = generateStarterTeam(new SeededRandomProvider(42));

      expect(team1.length).toBe(team2.length);

      // Stats should be identical
      for (let i = 0; i < team1.length; i++) {
        expect(team1[i].stats).toEqual(team2[i].stats);
        expect(team1[i].role).toEqual(team2[i].role);
        expect(team1[i].salary).toEqual(team2[i].salary);
      }
    });

    it("should generate unique player IDs", () => {
      const rng = new SeededRandomProvider(12345);
      const team = generateStarterTeam(rng);
      const ids = team.map((p) => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(team.length);
    });
  });

  describe("generateTeamByTier", () => {
    it("should generate team of correct size", () => {
      const rng = new SeededRandomProvider(12345);
      const team = generateTeamByTier("AVERAGE", rng);

      expect(team.length).toBe(
        GAME_CONSTANTS.STARTER_ROSTER.BATTERS +
          GAME_CONSTANTS.STARTER_ROSTER.STARTERS +
          GAME_CONSTANTS.STARTER_ROSTER.RELIEVERS
      );
    });

    it("should generate all players at specified tier", () => {
      const rng = new SeededRandomProvider(12345);
      const eliteTeam = generateTeamByTier("ELITE", rng);
      const rookieTeam = generateTeamByTier(
        "ROOKIE",
        new SeededRandomProvider(12345)
      );

      const eliteBatters = eliteTeam.filter(isBatter);
      const rookieBatters = rookieTeam.filter(isBatter);

      // Calculate average stats
      const eliteAvgPower =
        eliteBatters.reduce((sum, b) => sum + (b.stats as any).power, 0) /
        eliteBatters.length;
      const rookieAvgPower =
        rookieBatters.reduce((sum, b) => sum + (b.stats as any).power, 0) /
        rookieBatters.length;

      // Elite team should have much better average stats
      expect(eliteAvgPower).toBeGreaterThan(rookieAvgPower + 20);
    });

    it("should handle all tier levels", () => {
      const tiers = ["ROOKIE", "AVERAGE", "GOOD", "STAR", "ELITE"] as const;

      for (const tier of tiers) {
        const team = generateTeamByTier(tier, new SeededRandomProvider(42));
        expect(team.length).toBeGreaterThan(0);
        expect(team.every((p) => p.stats)).toBe(true);
      }
    });

    it("should be deterministic with same seed", () => {
      const team1 = generateTeamByTier("STAR", new SeededRandomProvider(123));
      const team2 = generateTeamByTier("STAR", new SeededRandomProvider(123));

      for (let i = 0; i < team1.length; i++) {
        expect(team1[i].stats).toEqual(team2[i].stats);
        expect(team1[i].role).toEqual(team2[i].role);
      }
    });
  });
});
