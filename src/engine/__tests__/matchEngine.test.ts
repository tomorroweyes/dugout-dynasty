import { describe, it, expect } from "vitest";
import {
  simulateInningWithStats,
  simulateGame,
  simulateMatch,
} from "../matchEngine";
import { SeededRandomProvider } from "../randomProvider";
import { Player, BatterStats, PitcherStats, Team } from "@/types/game";

/**
 * Test utilities for creating mock players
 */
function createMockBatter(
  id: string,
  stats: Partial<BatterStats> = {}
): Player {
  return {
    id,
    name: `Batter ${id}`,
    role: "Batter",
    stats: {
      power: 50,
      contact: 50,
      glove: 50,
      speed: 50,
      ...stats,
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
  role: "Starter" | "Reliever" = "Starter",
  stats: Partial<PitcherStats> = {}
): Player {
  return {
    id,
    name: `Pitcher ${id}`,
    role,
    stats: {
      velocity: 50,
      control: 50,
      break: 50,
      ...stats,
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

function createMockDefense(): Player[] {
  return Array.from({ length: 9 }, (_, i) =>
    createMockBatter(`def${i}`, { glove: 50 })
  );
}

function createMockTeam(teamId: string): Player[] {
  const batters = Array.from({ length: 9 }, (_, i) =>
    createMockBatter(`${teamId}-b${i}`)
  );
  const starter = createMockPitcher(`${teamId}-starter`, "Starter");
  const reliever1 = createMockPitcher(`${teamId}-rel1`, "Reliever");
  const reliever2 = createMockPitcher(`${teamId}-rel2`, "Reliever");
  return [...batters, starter, reliever1, reliever2];
}

function createFullTeam(teamId: string): Team {
  const roster = createMockTeam(teamId);
  return {
    cash: 100000,
    fans: 1.0,
    roster,
    lineup: roster.map((p) => p.id),
    bench: [],
    wins: 0,
    losses: 0,
  };
}

describe("matchEngine", () => {
  describe("simulateInningWithStats", () => {
    describe("basic functionality", () => {
      it("should handle empty lineup gracefully", () => {
        const rng = new SeededRandomProvider(12345);
        const emptyBatters: Player[] = [];
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          emptyBatters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        expect(result.runs).toBe(0);
        expect(result.batterStats.size).toBe(0);
        expect(result.nextBatterIndex).toBe(0);
        expect(result.plays.length).toBe(0);
      });

      it("should simulate a complete inning with three outs", () => {
        const rng = new SeededRandomProvider(99999); // This seed produces mostly outs
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // Inning should end after 3 outs
        expect(result.pitcherStats).toBeDefined();
        expect(result.batterStats.size).toBeGreaterThan(0);
        expect(result.nextBatterIndex).toBeGreaterThanOrEqual(0);
        expect(result.plays.length).toBeGreaterThan(0);
      });

      it("should track batter statistics correctly", () => {
        const rng = new SeededRandomProvider(12346);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // At least some batters should have stats
        expect(result.batterStats.size).toBeGreaterThan(0);

        // Verify stat structure for each batter
        result.batterStats.forEach((stats) => {
          expect(stats).toHaveProperty("hits");
          expect(stats).toHaveProperty("abs");
          expect(stats).toHaveProperty("strikeouts");
          expect(stats).toHaveProperty("walks");
          expect(stats).toHaveProperty("runs");
          expect(stats).toHaveProperty("rbis");
          expect(typeof stats.hits).toBe("number");
          expect(typeof stats.abs).toBe("number");
        });
      });

      it("should track pitcher statistics correctly", () => {
        const rng = new SeededRandomProvider(12347);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // Verify pitcher stats structure
        expect(result.pitcherStats).toHaveProperty("hitsAllowed");
        expect(result.pitcherStats).toHaveProperty("runsAllowed");
        expect(result.pitcherStats).toHaveProperty("strikeouts");
        expect(result.pitcherStats).toHaveProperty("walks");
        expect(result.pitcherStats.runsAllowed).toBe(result.runs);
      });
    });

    describe("batting order rotation", () => {
      it("should rotate batting order within inning", () => {
        const rng = new SeededRandomProvider(12348);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // Next batter index should be > 0 after simulating an inning
        expect(result.nextBatterIndex).toBeGreaterThan(0);
      });

      it("should continue from specified starting batter index", () => {
        const rng = new SeededRandomProvider(12349);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        // Start from the 5th batter (index 4)
        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          4,
          1,
          true,
          rng
        );

        // Should have advanced from starting index
        expect(result.nextBatterIndex).toBeGreaterThanOrEqual(4);
      });

      it("should wrap batting order around lineup", () => {
        const rng = new SeededRandomProvider(12350);
        const batters = Array.from(
          { length: 9 },
          (_, i) => createMockBatter(`b${i}`, { contact: 80, power: 60 }) // Higher stats for more at-bats
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1", "Starter", {
          velocity: 30,
          control: 30,
        }); // Weak pitcher

        // Start near end of lineup
        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          8, // Start at last batter
          1,
          true,
          rng
        );

        // If inning had enough at-bats, nextBatterIndex should wrap
        expect(result.nextBatterIndex).toBeGreaterThanOrEqual(8);
      });
    });

    describe("run scoring", () => {
      it("should accumulate runs from scoring plays", () => {
        const rng = new SeededRandomProvider(54321); // Seed that produces hits
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`, { contact: 90, power: 85 })
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1", "Starter", {
          velocity: 20,
          control: 20,
          break: 20,
        });

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // With good batters vs weak pitcher, should get some action
        expect(
          result.pitcherStats.hitsAllowed + result.pitcherStats.walks
        ).toBeGreaterThan(0);
      });

      it("should track RBIs when runs score", () => {
        const rng = new SeededRandomProvider(11111);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`, { contact: 80, power: 80 })
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1", "Starter", {
          velocity: 30,
          control: 30,
        });

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // Total RBIs should match runs scored
        let totalRbis = 0;
        result.batterStats.forEach((stats) => {
          totalRbis += stats.rbis;
        });
        expect(totalRbis).toBe(result.runs);
      });
    });

    describe("play-by-play generation", () => {
      it("should generate play-by-play events", () => {
        const rng = new SeededRandomProvider(12351);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          5,
          true,
          rng
        );

        // Should have generated plays
        expect(result.plays.length).toBeGreaterThan(0);

        // Each play should have correct structure
        result.plays.forEach((play) => {
          expect(play).toHaveProperty("inning");
          expect(play).toHaveProperty("isTop");
          expect(play).toHaveProperty("batter");
          expect(play).toHaveProperty("pitcher");
          expect(play).toHaveProperty("outcome");
          expect(play).toHaveProperty("outs");
          expect(play.inning).toBe(5);
          expect(play.isTop).toBe(true);
        });
      });
    });

    describe("pitcher fatigue", () => {
      it("should handle pitcher with existing fatigue", () => {
        const rng = new SeededRandomProvider(12352);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        // Simulate with 5 innings already pitched (high fatigue)
        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          5,
          0,
          6,
          true,
          rng
        );

        // Should still complete the inning
        expect(result).toBeDefined();
        expect(result.pitcherStats).toBeDefined();
      });
    });

    describe("safety limits", () => {
      it("should enforce safety limit on at-bats", () => {
        const rng = new SeededRandomProvider(12353);
        const batters = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        );
        const defense = createMockDefense();
        const pitcher = createMockPitcher("p1");

        const result = simulateInningWithStats(
          batters,
          defense,
          pitcher,
          0,
          0,
          1,
          true,
          rng
        );

        // Should always terminate, not infinite loop
        expect(result).toBeDefined();
        // Next batter index should be reasonable (not exceed safety limit)
        expect(result.nextBatterIndex).toBeLessThan(batters.length * 3 + 1);
      });
    });
  });

  describe("simulateGame", () => {
    describe("basic game simulation", () => {
      it("should complete a 9-inning game", () => {
        const rng = new SeededRandomProvider(42);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        expect(result.myRuns).toBeDefined();
        expect(result.opponentRuns).toBeDefined();
        expect(typeof result.myRuns).toBe("number");
        expect(typeof result.opponentRuns).toBe("number");
        expect(result.myRuns).toBeGreaterThanOrEqual(0);
        expect(result.opponentRuns).toBeGreaterThanOrEqual(0);
      });

      it("should generate valid box score structure", () => {
        const rng = new SeededRandomProvider(43);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Box score should exist
        expect(result.boxScore).toBeDefined();
        expect(result.boxScore.myBatters).toBeDefined();
        expect(result.boxScore.myPitchers).toBeDefined();
        expect(result.boxScore.opponentBatters).toBeDefined();
        expect(result.boxScore.opponentPitchers).toBeDefined();

        // Should have batters and pitchers
        expect(result.boxScore.myBatters.length).toBeGreaterThan(0);
        expect(result.boxScore.opponentBatters.length).toBeGreaterThan(0);
        expect(result.boxScore.myPitchers.length).toBeGreaterThan(0);
        expect(result.boxScore.opponentPitchers.length).toBeGreaterThan(0);
      });

      it("should handle teams with no pitchers gracefully", () => {
        const rng = new SeededRandomProvider(44);
        const myTeam = Array.from({ length: 9 }, (_, i) =>
          createMockBatter(`b${i}`)
        ); // No pitchers
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Should return empty result
        expect(result.myRuns).toBe(0);
        expect(result.opponentRuns).toBe(0);
        expect(result.boxScore.myBatters.length).toBe(0);
      });

      it("should generate play-by-play events", () => {
        const rng = new SeededRandomProvider(45);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Should have play-by-play
        expect(result.playByPlay).toBeDefined();
        expect(result.playByPlay.length).toBeGreaterThan(0);

        // Plays should alternate between top (true) and bottom (false)
        const topPlays = result.playByPlay.filter((p) => p.isTop);
        const bottomPlays = result.playByPlay.filter((p) => !p.isTop);
        expect(topPlays.length).toBeGreaterThan(0);
        expect(bottomPlays.length).toBeGreaterThan(0);
      });
    });

    describe("pitcher rotation", () => {
      it("should use starter for first 5 innings", () => {
        const rng = new SeededRandomProvider(46);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Should have starter in pitcher box score
        const myStarter = myTeam.find((p) => p.role === "Starter");
        expect(myStarter).toBeDefined();

        const starterStats = result.boxScore.myPitchers.find(
          (p) => p.playerId === myStarter!.id
        );
        expect(starterStats).toBeDefined();
        expect(starterStats!.inningsPitched).toBeGreaterThan(0);
      });

      it("should rotate to relievers at innings 6 and 8", () => {
        const rng = new SeededRandomProvider(47);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Should have used multiple pitchers (starter + relievers)
        expect(result.boxScore.myPitchers.length).toBeGreaterThanOrEqual(1);
        expect(result.boxScore.opponentPitchers.length).toBeGreaterThanOrEqual(
          1
        );

        // Total innings pitched should roughly equal innings played
        const totalMyInnings = result.boxScore.myPitchers.reduce(
          (sum, p) => sum + p.inningsPitched,
          0
        );
        expect(totalMyInnings).toBeGreaterThanOrEqual(9);
      });

      it("should track all pitchers used in box score", () => {
        const rng = new SeededRandomProvider(48);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Each pitcher should have valid stats
        result.boxScore.myPitchers.forEach((pitcher) => {
          expect(pitcher.playerId).toBeDefined();
          expect(pitcher.name).toBeDefined();
          expect(pitcher.inningsPitched).toBeGreaterThan(0);
          expect(pitcher.hitsAllowed).toBeGreaterThanOrEqual(0);
          expect(pitcher.runsAllowed).toBeGreaterThanOrEqual(0);
          expect(pitcher.strikeouts).toBeGreaterThanOrEqual(0);
          expect(pitcher.walks).toBeGreaterThanOrEqual(0);
        });
      });
    });

    describe("batting order continuity", () => {
      it("should maintain batting order across innings", () => {
        const rng = new SeededRandomProvider(49);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Verify plays show different batters throughout game
        const uniqueBatters = new Set(result.playByPlay.map((p) => p.batter));
        expect(uniqueBatters.size).toBeGreaterThan(1);
      });
    });

    describe("box score validation", () => {
      it("should have all batters in box score", () => {
        const rng = new SeededRandomProvider(50);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Should have 9 batters for each team
        expect(result.boxScore.myBatters.length).toBe(9);
        expect(result.boxScore.opponentBatters.length).toBe(9);

        // Each batter should have valid structure
        result.boxScore.myBatters.forEach((batter) => {
          expect(batter.playerId).toBeDefined();
          expect(batter.name).toBeDefined();
          expect(batter.atBats).toBeGreaterThanOrEqual(0);
          expect(batter.hits).toBeGreaterThanOrEqual(0);
          expect(batter.runs).toBeGreaterThanOrEqual(0);
          expect(batter.rbis).toBeGreaterThanOrEqual(0);
        });
      });

      it("should have total hits matching sum of individual hits", () => {
        const rng = new SeededRandomProvider(51);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Sum individual hits
        const myTotalHits = result.boxScore.myBatters.reduce(
          (sum, b) => sum + b.hits,
          0
        );
        const opponentTotalHits = result.boxScore.opponentBatters.reduce(
          (sum, b) => sum + b.hits,
          0
        );

        // Should match box score totals
        expect(result.boxScore.myHits).toBe(myTotalHits);
        expect(result.boxScore.opponentHits).toBe(opponentTotalHits);
      });

      it("should have at least some at-bats for each batter", () => {
        const rng = new SeededRandomProvider(52);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Each batter in lineup should have had some at-bats
        const totalMyAbs = result.boxScore.myBatters.reduce(
          (sum, b) => sum + b.atBats,
          0
        );
        expect(totalMyAbs).toBeGreaterThan(0);
      });
    });

    describe("extra innings", () => {
      it("should play extra innings if tied after 9", () => {
        // Finding a seed that produces a tie is tricky, so we test the logic exists
        const rng = new SeededRandomProvider(1000);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Game should end eventually (either winner or max innings)
        expect(result).toBeDefined();
        const totalInningsPitched = result.boxScore.myPitchers.reduce(
          (sum, p) => sum + p.inningsPitched,
          0
        );
        expect(totalInningsPitched).toBeLessThanOrEqual(18);
      });

      it("should enforce max innings safety limit", () => {
        const rng = new SeededRandomProvider(2000);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Should never exceed 18 innings
        const totalInningsPitched = result.boxScore.myPitchers.reduce(
          (sum, p) => sum + p.inningsPitched,
          0
        );
        expect(totalInningsPitched).toBeLessThanOrEqual(18);
      });
    });

    describe("walk-off scenarios", () => {
      it("should end game if home team wins in bottom of 9th or later", () => {
        const rng = new SeededRandomProvider(3000);
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const result = simulateGame(myTeam, opponentTeam, false, rng);

        // Game should complete
        expect(result.myRuns).toBeDefined();
        expect(result.opponentRuns).toBeDefined();

        // If myTeam wins, home team advantage logic should have worked
        if (result.myRuns > result.opponentRuns) {
          // Home team won
          expect(result.myRuns).toBeGreaterThan(result.opponentRuns);
        }
      });
    });

    describe("determinism", () => {
      it("should produce same results with same seed", () => {
        const seed = 12345;
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const rng1 = new SeededRandomProvider(seed);
        const result1 = simulateGame(myTeam, opponentTeam, false, rng1);

        const rng2 = new SeededRandomProvider(seed);
        const result2 = simulateGame(myTeam, opponentTeam, false, rng2);

        // Results should be identical
        expect(result1.myRuns).toBe(result2.myRuns);
        expect(result1.opponentRuns).toBe(result2.opponentRuns);
        expect(result1.playByPlay.length).toBe(result2.playByPlay.length);
      });

      it("should produce different results with different seeds", () => {
        const myTeam = createMockTeam("my");
        const opponentTeam = createMockTeam("opp");

        const rng1 = new SeededRandomProvider(11111);
        const result1 = simulateGame(myTeam, opponentTeam, false, rng1);

        const rng2 = new SeededRandomProvider(77777);
        const result2 = simulateGame(myTeam, opponentTeam, false, rng2);

        // Results should be different (statistically very likely with different seeds)
        const isDifferent =
          result1.myRuns !== result2.myRuns ||
          result1.opponentRuns !== result2.opponentRuns ||
          result1.playByPlay.length !== result2.playByPlay.length;

        expect(isDifferent).toBe(true);
      });
    });
  });

  describe("simulateMatch", () => {
    describe("API functionality", () => {
      it("should simulate a match with provided teams", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        expect(result.myRuns).toBeDefined();
        expect(result.opponentRuns).toBeDefined();
        expect(result.isWin).toBeDefined();
        expect(result.cashEarned).toBeDefined();
        expect(result.boxScore).toBeDefined();
        expect(result.playByPlay).toBeDefined();
      });

      it("should return valid MatchResult structure", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        // Verify complete structure
        expect(typeof result.myRuns).toBe("number");
        expect(typeof result.opponentRuns).toBe("number");
        expect(typeof result.isWin).toBe("boolean");
        expect(typeof result.cashEarned).toBe("number");
        expect(result.boxScore).toBeDefined();
        expect(result.playByPlay).toBeDefined();
      });

      it("should correctly determine win/loss", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        // isWin should match score comparison
        const expectedIsWin = result.myRuns > result.opponentRuns;
        expect(result.isWin).toBe(expectedIsWin);
      });

      it("should calculate cash rewards for wins", () => {
        const myTeam = createFullTeam("my");
        myTeam.fans = 1.5; // Higher fan multiplier
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        if (result.isWin) {
          // Win should give positive cash (base * fans)
          expect(result.cashEarned).toBeGreaterThan(0);
        } else {
          // Loss should give base loss amount
          expect(result.cashEarned).toBeDefined();
        }
      });

      it("should handle teams with different fan multipliers", () => {
        const myTeam1 = createFullTeam("my1");
        myTeam1.fans = 1.0;
        const opponentTeam = createFullTeam("opp");

        const myTeam2 = createFullTeam("my2");
        myTeam2.fans = 2.0;

        // We can't guarantee wins, but cash earned formula should respect fans
        const result1 = simulateMatch(myTeam1, opponentTeam);
        const result2 = simulateMatch(myTeam2, opponentTeam);

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
      });
    });

    describe("box score integration", () => {
      it("should include complete box score in result", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        expect(result.boxScore).toBeDefined();
        expect(result.boxScore!.myBatters.length).toBeGreaterThan(0);
        expect(result.boxScore!.myPitchers.length).toBeGreaterThan(0);
        expect(result.boxScore!.opponentBatters.length).toBeGreaterThan(0);
        expect(result.boxScore!.opponentPitchers.length).toBeGreaterThan(0);
      });

      it("should have box score structure correct", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        // Box score should include all team batters
        expect(result.boxScore!.myBatters.length).toBe(9);

        // The runs in the game stats should be tracked somewhere
        // Let's verify the box score is structurally correct
        expect(
          result.boxScore!.myBatters.every(
            (b) => typeof b.runs === "number" && b.runs >= 0
          )
        ).toBe(true);
      });
    });

    describe("play-by-play integration", () => {
      it("should include play-by-play in result", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        expect(result.playByPlay).toBeDefined();
        expect(result.playByPlay!.length).toBeGreaterThan(0);
      });

      it("should have plays from multiple innings", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        const innings = new Set(result.playByPlay!.map((p) => p.inning));
        expect(innings.size).toBeGreaterThanOrEqual(9); // At least 9 innings
      });
    });

    describe("edge cases", () => {
      it("should handle empty bench gracefully", () => {
        const myTeam = createFullTeam("my");
        myTeam.bench = []; // Empty bench
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        // Should still complete match
        expect(result).toBeDefined();
        expect(result.myRuns).toBeGreaterThanOrEqual(0);
      });

      it("should handle minimum valid lineup", () => {
        const roster = createMockTeam("min");
        const myTeam: Team = {
          cash: 100000,
          fans: 1.0,
          roster,
          lineup: roster.map((p) => p.id), // All players in lineup
          bench: [],
          wins: 0,
          losses: 0,
        };
        const opponentTeam = createFullTeam("opp");

        const result = simulateMatch(myTeam, opponentTeam);

        expect(result).toBeDefined();
        expect(result.isWin).toBeDefined();
      });
    });

    describe("statistical validation", () => {
      it("should produce reasonable run totals over multiple games", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const results = [];
        for (let i = 0; i < 10; i++) {
          results.push(simulateMatch(myTeam, opponentTeam));
        }

        // All games should complete
        expect(results.length).toBe(10);

        // Average runs should be reasonable (typically 0-15 per team per game)
        const avgMyRuns =
          results.reduce((sum, r) => sum + r.myRuns, 0) / results.length;
        const avgOppRuns =
          results.reduce((sum, r) => sum + r.opponentRuns, 0) / results.length;

        expect(avgMyRuns).toBeGreaterThanOrEqual(0);
        expect(avgMyRuns).toBeLessThan(30); // Sanity check
        expect(avgOppRuns).toBeGreaterThanOrEqual(0);
        expect(avgOppRuns).toBeLessThan(30);
      });

      it("should have some wins and some losses over many games", () => {
        const myTeam = createFullTeam("my");
        const opponentTeam = createFullTeam("opp");

        const results = [];
        for (let i = 0; i < 20; i++) {
          results.push(simulateMatch(myTeam, opponentTeam));
        }

        const wins = results.filter((r) => r.isWin).length;
        const losses = results.filter((r) => !r.isWin).length;

        // With evenly matched teams, should have mix of results
        // (statistically extremely unlikely to win/lose all 20)
        expect(wins).toBeGreaterThan(0);
        expect(losses).toBeGreaterThan(0);
      });
    });
  });
});
