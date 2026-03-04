import { describe, it, expect } from "vitest";
import type {
  BreakthroughArchetype,
  BreakthroughEvent,
  BreakthroughTriggeredAt,
  SignatureSkill,
  SignatureSkillReputation,
} from "@/types/breakthroughs";
import { BREAKTHROUGH_TRIGGER_CONDITIONS, SIGNATURE_SKILL_GENERATION } from "@/types/breakthroughs";

describe("Breakthrough Types", () => {
  it("should define all 4 breakthrough archetypes", () => {
    const archetypes: BreakthroughArchetype[] = [
      "contrast_moment",
      "streak_moment",
      "comeback_moment",
      "specialization_moment",
    ];
    expect(archetypes).toHaveLength(4);
    archetypes.forEach((a) => expect(a).toBeTruthy());
  });

  it("should create a valid BreakthroughTriggeredAt", () => {
    const triggered: BreakthroughTriggeredAt = {
      gameNumber: 12,
      inning: 9,
      scoreDiff: 0,
      context: "bases loaded, 2 outs",
    };
    expect(triggered.gameNumber).toBe(12);
    expect(triggered.inning).toBe(9);
    expect(triggered.scoreDiff).toBe(0);
  });

  it("should create a valid BreakthroughEvent", () => {
    const event: BreakthroughEvent = {
      breakthroughId: "bt-001",
      playerId: "p-123",
      skillId: "ice-veins",
      skillRank: 3,
      archetype: "contrast_moment",
      triggeredAt: {
        gameNumber: 12,
        inning: 9,
        scoreDiff: 0,
        context: "bases loaded, 9th inning",
      },
      narrative: "Something clicked for Rivera today...",
      memoryLabel: "Rivera's Hammer (walk-off vs Steel City Rollers, S3G12)",
      createdAt: new Date(),
    };
    expect(event.breakthroughId).toBe("bt-001");
    expect(event.skillRank).toBe(3);
    expect(event.archetype).toBe("contrast_moment");
  });

  it("should create a SignatureSkill with reputation", () => {
    const reputation: SignatureSkillReputation = {
      knownBy: ["Steel City Rollers", "North Shore Surge"],
      counterStrategies: ["Pitch outside", "Use relievers"],
      scoutLevel: 2,
    };
    expect(reputation.scoutLevel).toBe(2);
    expect(reputation.knownBy).toHaveLength(2);
  });

  it("should create a full SignatureSkill", () => {
    const event: BreakthroughEvent = {
      breakthroughId: "bt-001",
      playerId: "p-123",
      skillId: "ice-veins",
      skillRank: 5,
      archetype: "contrast_moment",
      triggeredAt: {
        gameNumber: 12,
        inning: 9,
        scoreDiff: 0,
        context: "bases loaded",
      },
      narrative: "Something clicked...",
      memoryLabel: "Rivera's Hammer (S3G12)",
      createdAt: new Date(),
    };

    const signature: SignatureSkill = {
      signatureId: "sig-001",
      skillId: "ice-veins",
      playerId: "p-123",
      skillName: "Rivera's Hammer",
      effectBonus: 0.1,
      unlockedAt: event,
      isActive: true,
      reputation: {
        knownBy: [],
        counterStrategies: [],
        scoutLevel: 0,
      },
    };
    expect(signature.skillName).toBe("Rivera's Hammer");
    expect(signature.effectBonus).toBe(0.1);
    expect(signature.isActive).toBe(true);
  });

  it("should have correct trigger condition constants", () => {
    expect(BREAKTHROUGH_TRIGGER_CONDITIONS.xpThresholdPercent).toBe(80);
    expect(BREAKTHROUGH_TRIGGER_CONDITIONS.baseProbability).toBe(0.35);
    expect(BREAKTHROUGH_TRIGGER_CONDITIONS.maxPerSeason).toBe(1);
    expect(BREAKTHROUGH_TRIGGER_CONDITIONS.traitBonuses.grit).toBe(0.1);
    expect(BREAKTHROUGH_TRIGGER_CONDITIONS.traitBonuses.flash).toBe(0.15);
    expect(BREAKTHROUGH_TRIGGER_CONDITIONS.badHabitPenalty).toBe(0.15);
  });

  it("should have correct signature skill generation constants", () => {
    expect(SIGNATURE_SKILL_GENERATION.rankRequired).toBe(5);
    expect(SIGNATURE_SKILL_GENERATION.badHabitBlocksSignature).toBe(true);
    expect(SIGNATURE_SKILL_GENERATION.effectBonusPercent).toBe(10);
    expect(SIGNATURE_SKILL_GENERATION.reputationStartLevel).toBe(0);
  });

  it("should support optional fields on BreakthroughEvent", () => {
    const event: BreakthroughEvent = {
      breakthroughId: "bt-001",
      playerId: "p-123",
      skillId: "ice-veins",
      skillRank: 5,
      archetype: "comeback_moment",
      triggeredAt: {
        gameNumber: 50,
        inning: 7,
        scoreDiff: 1,
        context: "down 1 run",
      },
      narrative: "Redemption arc complete",
      mentorNarrative: "[Mentor] smiled knowingly from the bench.",
      signatureSkillId: "sig-001",
      memoryLabel: "Tying run scores (S3G50)",
      createdAt: new Date(),
    };
    expect(event.mentorNarrative).toBeDefined();
    expect(event.signatureSkillId).toBe("sig-001");
  });

  it("should support different scout levels (0-3)", () => {
    const levels: SignatureSkillReputation[] = [
      { knownBy: [], counterStrategies: [], scoutLevel: 0 },
      { knownBy: ["Team A"], counterStrategies: [], scoutLevel: 1 },
      { knownBy: ["Team A", "Team B"], counterStrategies: ["Strategy 1"], scoutLevel: 2 },
      { knownBy: ["Team A", "Team B", "Team C"], counterStrategies: ["Strategy 1", "Strategy 2"], scoutLevel: 3 },
    ];
    levels.forEach((level, i) => {
      expect(level.scoutLevel).toBe(i);
    });
  });
});
