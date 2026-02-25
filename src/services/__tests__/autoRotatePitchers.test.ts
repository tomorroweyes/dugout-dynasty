/**
 * Tests for auto-rotation pitcher system
 * Note: Most tests have been removed as they tested stamina-based rotation
 * which has been removed from the codebase.
 */

import { describe, it, expect } from "vitest";
import { GameController } from "../GameController";
import { Team, Player } from "@/types/game";

describe("Auto-Rotate Pitchers", () => {
  const createMockPlayer = (
    id: string,
    role: "Batter" | "Starter" | "Reliever",
    rating: number = 50
  ): Player => ({
    id,
    name: `Player ${id}`,
    role,
    stats:
      role === "Batter"
        ? { power: rating, contact: rating, glove: rating, speed: rating }
        : { velocity: rating, control: rating, break: rating },
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
  });

  const createMockTeam = (): Team => {
    const batters = Array.from({ length: 9 }, (_, i) =>
      createMockPlayer(`b${i}`, "Batter", 50)
    );
    const starters = [
      createMockPlayer("s1", "Starter", 60),
      createMockPlayer("s2", "Starter", 50),
      createMockPlayer("s3", "Starter", 40),
    ];
    const relievers = [
      createMockPlayer("r1", "Reliever", 60),
      createMockPlayer("r2", "Reliever", 50),
      createMockPlayer("r3", "Reliever", 40),
    ];

    const roster = [...batters, ...starters, ...relievers];

    return {
      cash: 5000,
      fans: 1.0,
      roster,
      lineup: [
        ...batters.map((p) => p.id),
        starters[0].id, // s1 in lineup
        relievers[0].id,
        relievers[1].id, // r1, r2 in lineup
      ],
      bench: [starters[1].id, starters[2].id, relievers[2].id], // s2, s3, r3 on bench
      wins: 0,
      losses: 0,
    };
  };

  it("should maintain valid lineup structure", () => {
    const controller = new GameController();
    const team = createMockTeam();

    // Test that autoRotatePitchers returns null when no changes needed
    const result = controller.autoRotatePitchers(team);

    // With no stamina system, this should return null as no rotation is needed
    expect(result).toBeNull();
  });
});
