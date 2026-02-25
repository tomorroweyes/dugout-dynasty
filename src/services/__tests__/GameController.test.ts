import { describe, it, expect } from "vitest";
import { GameController } from "../GameController";
import { Team, Player } from "@/types/game";

describe("GameController - autoFix", () => {
  // Note: Most autoFix tests have been removed as they were testing stamina-based rotation
  // which has been removed from the codebase.
  /**
   * Helper to create a test player
   */
  function createPlayer(
    id: string,
    role: "Batter" | "Starter" | "Reliever",
    baseRating: number
  ): Player {
    const stats =
      role === "Batter"
        ? {
            power: baseRating,
            contact: baseRating,
            glove: baseRating,
          }
        : {
            velocity: baseRating,
            control: baseRating,
            break: baseRating,
          };

    return {
      id,
      name: `Player ${id}`,
      role,
      stats,
      salary: 1000,
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

  /**
   * Helper to create a test team
   */
  function createTestTeam(players: Player[]): Team {
    return {
      roster: players,
      lineup: [],
      bench: [],
      cash: 5000,
      fans: 1.0,
      wins: 0,
      losses: 0,
    };
  }

  it("should select best players for lineup", () => {
    const controller = new GameController();

    // Elite batter
    const elitePlayer = createPlayer("elite", "Batter", 80);

    // Average batter
    const averagePlayer = createPlayer("average", "Batter", 50);

    // Weak batters
    const weakBatters = Array.from({ length: 11 }, (_, i) =>
      createPlayer(`weak${i}`, "Batter", 30)
    );

    // Add required pitchers
    const pitchers = [
      createPlayer("starter1", "Starter", 50),
      createPlayer("starter2", "Starter", 48),
      createPlayer("starter3", "Starter", 46),
      createPlayer("rel1", "Reliever", 50),
      createPlayer("rel2", "Reliever", 48),
      createPlayer("rel3", "Reliever", 46),
    ];

    const team = createTestTeam([
      elitePlayer,
      averagePlayer,
      ...weakBatters,
      ...pitchers,
    ]);

    const result = controller.autoFix(team);

    // Should select best players for lineup
    expect(result).not.toBeNull();
    expect(result!.lineup).toContain("elite");
    expect(result!.lineup).toContain("average");
  });
});
