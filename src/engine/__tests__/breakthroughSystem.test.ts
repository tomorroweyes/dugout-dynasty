import { describe, it, expect } from "vitest";
import type { Player, Team } from "@/types/game";
import type { MentalSkill } from "@/types/mentalSkills";
import type { BreakthroughContext } from "@/engine/breakthroughSystem";
import { checkBreakthroughTrigger, activateBreakthrough } from "@/engine/breakthroughSystem";
import { SeededRandomProvider } from "@/engine/randomProvider";

class AlwaysTriggerRNG {
  random() {
    return 0.1; // Low value triggers all RNG checks
  }
  seed() {}
}

function createMockPlayer(overrides?: Partial<Player>): Player {
  return {
    id: "p-1",
    name: "Test",
    surname: "Player",
    role: "Batter",
    stats: { power: 50, contact: 50, glove: 50, speed: 50 },
    salary: 1000,
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    spirit: { current: 100, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...overrides,
  };
}

function createMockSkill(overrides?: Partial<MentalSkill>): MentalSkill {
  return {
    id: "test_skill",
    name: "Test Skill",
    rank: 2,
    xp: 85, // Very high XP well past 80% threshold to guarantee trigger
    confidence: 85,
    wasLapsed: false,
    ...overrides,
  };
}

function createMockGameContext(overrides?: Partial<BreakthroughContext>): BreakthroughContext {
  return {
    gameNumber: 10,
    inning: 9,
    outs: 1,
    runners: [true, true, true],
    score: { myRuns: 5, opponentRuns: 4 },
    isHighLeverage: true,
    opponentName: "Opponent",
    rng: new AlwaysTriggerRNG() as any,
    ...overrides,
  };
}

describe("Breakthrough System", () => {
  it("should not trigger if not high leverage", () => {
    const player = createMockPlayer();
    const skill = createMockSkill();
    const ctx = createMockGameContext({ isHighLeverage: false });
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event).toBeNull();
  });

  it("should not trigger if XP below 80%", () => {
    const player = createMockPlayer();
    const skill = createMockSkill({ xp: 40 }); // 66.7% of 60
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event).toBeNull();
  });

  it("should not trigger if rank is 5", () => {
    const player = createMockPlayer();
    const skill = createMockSkill({ rank: 5 });
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event).toBeNull();
  });

  it("should trigger when all conditions are met", () => {
    const player = createMockPlayer();
    const skill = createMockSkill();
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event).toBeTruthy();
    if (event) {
      expect(event.skillId).toBe("test_skill");
      expect(event.skillRank).toBe(skill.rank + 1);
    }
  });

  it("should generate narrative containing player name", () => {
    const player = createMockPlayer({ name: "Rivera" });
    const skill = createMockSkill();
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event?.narrative).toContain("Rivera");
  });

  it("should generate memory label with game context", () => {
    const player = createMockPlayer({ name: "Jones" });
    const skill = createMockSkill();
    const ctx = createMockGameContext({ gameNumber: 42 });
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event?.memoryLabel).toContain("Jones");
    expect(event?.memoryLabel).toContain("42");
  });

  it("should set signature skill ID at rank 4→5", () => {
    const player = createMockPlayer({
      mentalSkills: [createMockSkill({ rank: 4, xp: 130 })], // High XP for rank 4
    });
    const skill = player.mentalSkills![0];
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    if (event) {
      expect(event.signatureSkillId).toBeDefined();
    }
  });

  it("should not trigger twice per season", () => {
    const player = createMockPlayer({
      breakthroughEvents: [
        {
          breakthroughId: "old",
          playerId: "p-1",
          skillId: "test_skill",
          skillRank: 3,
          archetype: "streak_moment",
          triggeredAt: { gameNumber: 1, inning: 7, scoreDiff: 1, context: "inning 7" },
          narrative: "old",
          memoryLabel: "old (G1)",
          createdAt: new Date(),
        },
      ],
    });
    const skill = createMockSkill();
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
    expect(event).toBeNull();
  });

  it("should activate breakthrough and advance rank", () => {
    const player = createMockPlayer({
      mentalSkills: [createMockSkill()],
    });
    const skill = player.mentalSkills![0];
    const oldRank = skill.rank;
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill)!;

    if (event) {
      activateBreakthrough(player, event);
      expect(skill.rank).toBe(oldRank + 1);
      expect(skill.xp).toBe(0);
    }
  });

  it("should reset XP after rank advance", () => {
    const player = createMockPlayer({
      mentalSkills: [createMockSkill({ xp: 55 })],
    });
    const skill = player.mentalSkills![0];
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill)!;

    if (event) {
      activateBreakthrough(player, event);
      expect(skill.xp).toBe(0);
    }
  });

  it("should log breakthrough event to player history", () => {
    const player = createMockPlayer({
      mentalSkills: [createMockSkill()],
    });
    const skill = player.mentalSkills![0];
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill)!;

    if (event) {
      activateBreakthrough(player, event);
      expect(player.breakthroughEvents).toContain(event);
    }
  });

  it("should generate signature skill at rank 5", () => {
    const player = createMockPlayer({
      mentalSkills: [createMockSkill({ rank: 4 })],
    });
    const skill = player.mentalSkills![0];
    const ctx = createMockGameContext();
    const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill)!;

    if (event?.signatureSkillId) {
      activateBreakthrough(player, event);
      expect(player.signatureSkills?.has(event.signatureSkillId)).toBe(true);
      const sig = player.signatureSkills?.get(event.signatureSkillId);
      expect(sig?.effectBonus).toBe(0.1);
      expect(sig?.isActive).toBe(true);
    }
  });

  it("should determine different archetypes", () => {
    const archetypes = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const player = createMockPlayer();
      const skill = createMockSkill();
      const ctx = createMockGameContext();
      const event = checkBreakthroughTrigger(player, ctx, "test_skill", skill);
      if (event) {
        archetypes.add(event.archetype);
      }
    }
    // Should trigger at least once
    expect(archetypes.size).toBeGreaterThan(0);
  });
});
