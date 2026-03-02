import { describe, it, expect } from "vitest";
import {
  TRAIT_TO_MENTAL_SKILL,
  MENTAL_SKILL_RANK_XP,
  MENTAL_SKILL_RANK_BONUS,
  MENTAL_SKILL_DISCOVERY_CONDITIONS,
  DEFAULT_DECAY_RATE,
  CONFIDENCE_ACTIVE_THRESHOLD,
  REACTIVATION_XP_MULTIPLIER,
} from "@/types/mentalSkills";
import type {
  MentalSkill,
  MentalSkillType,
  MentalSkillRank,
  PhysicalPotential,
} from "@/types/mentalSkills";

describe("TRAIT_TO_MENTAL_SKILL mapping", () => {
  it("Ice maps to ice_veins", () => {
    expect(TRAIT_TO_MENTAL_SKILL["Ice"]).toBe("ice_veins");
  });

  it("Eye maps to pitch_recognition", () => {
    expect(TRAIT_TO_MENTAL_SKILL["Eye"]).toBe("pitch_recognition");
  });

  it("Heart maps to clutch_composure", () => {
    expect(TRAIT_TO_MENTAL_SKILL["Heart"]).toBe("clutch_composure");
  });

  it("Wile maps to veteran_poise", () => {
    expect(TRAIT_TO_MENTAL_SKILL["Wile"]).toBe("veteran_poise");
  });

  it("Brain maps to game_reading", () => {
    expect(TRAIT_TO_MENTAL_SKILL["Brain"]).toBe("game_reading");
  });

  it("covers all 5 core mental skills", () => {
    const values = Object.values(TRAIT_TO_MENTAL_SKILL);
    const expected: MentalSkillType[] = [
      "ice_veins",
      "pitch_recognition",
      "clutch_composure",
      "veteran_poise",
      "game_reading",
    ];
    for (const skill of expected) {
      expect(values).toContain(skill);
    }
  });

  it("traits without mental skills return undefined", () => {
    expect(TRAIT_TO_MENTAL_SKILL["Muscle"]).toBeUndefined();
    expect(TRAIT_TO_MENTAL_SKILL["Fire"]).toBeUndefined();
    expect(TRAIT_TO_MENTAL_SKILL["Grit"]).toBeUndefined();
    expect(TRAIT_TO_MENTAL_SKILL["Glue"]).toBeUndefined();
    expect(TRAIT_TO_MENTAL_SKILL["Flash"]).toBeUndefined();
  });
});

describe("MENTAL_SKILL_RANK_XP", () => {
  it("rank 0 costs 40 XP to start progression", () => {
    expect(MENTAL_SKILL_RANK_XP[0]).toBe(40);
  });

  it("XP costs increase with rank", () => {
    const ranks: MentalSkillRank[] = [0, 1, 2, 3, 4];
    for (let i = 1; i < ranks.length; i++) {
      expect(MENTAL_SKILL_RANK_XP[ranks[i]]).toBeGreaterThan(
        MENTAL_SKILL_RANK_XP[ranks[i - 1]]
      );
    }
  });

  it("rank 5 requires 0 XP (already maxed)", () => {
    expect(MENTAL_SKILL_RANK_XP[5]).toBe(0);
  });

  it("covers all 6 rank values", () => {
    const ranks: MentalSkillRank[] = [0, 1, 2, 3, 4, 5];
    for (const rank of ranks) {
      expect(MENTAL_SKILL_RANK_XP[rank]).toBeDefined();
    }
  });
});

describe("MENTAL_SKILL_RANK_BONUS", () => {
  it("rank 0 gives no bonus", () => {
    expect(MENTAL_SKILL_RANK_BONUS[0]).toBe(0);
  });

  it("bonuses increase with rank", () => {
    const ranks: MentalSkillRank[] = [0, 1, 2, 3, 4, 5];
    for (let i = 1; i < ranks.length; i++) {
      expect(MENTAL_SKILL_RANK_BONUS[ranks[i]]).toBeGreaterThan(
        MENTAL_SKILL_RANK_BONUS[ranks[i - 1]]
      );
    }
  });

  it("rank 5 gives the maximum bonus", () => {
    expect(MENTAL_SKILL_RANK_BONUS[5]).toBe(13);
  });
});

describe("MENTAL_SKILL_DISCOVERY_CONDITIONS", () => {
  it("has exactly 5 conditions (one per core skill)", () => {
    expect(MENTAL_SKILL_DISCOVERY_CONDITIONS).toHaveLength(5);
  });

  it("veteran_poise requires age 31+", () => {
    const poise = MENTAL_SKILL_DISCOVERY_CONDITIONS.find(
      (c) => c.skillId === "veteran_poise"
    );
    expect(poise?.minAge).toBe(31);
  });

  it("ice_veins and clutch_composure require high-leverage context", () => {
    const leverageRequired = MENTAL_SKILL_DISCOVERY_CONDITIONS.filter(
      (c) => c.leverageRequired
    ).map((c) => c.skillId);
    expect(leverageRequired).toContain("ice_veins");
    expect(leverageRequired).toContain("clutch_composure");
  });

  it("each condition has a unique skillId", () => {
    const ids = MENTAL_SKILL_DISCOVERY_CONDITIONS.map((c) => c.skillId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("each condition specifies a traitRequired", () => {
    for (const cond of MENTAL_SKILL_DISCOVERY_CONDITIONS) {
      expect(cond.traitRequired).toBeTruthy();
    }
  });
});

describe("Constants", () => {
  it("DEFAULT_DECAY_RATE is 5", () => {
    expect(DEFAULT_DECAY_RATE).toBe(5);
  });

  it("CONFIDENCE_ACTIVE_THRESHOLD is 10", () => {
    expect(CONFIDENCE_ACTIVE_THRESHOLD).toBe(10);
  });

  it("REACTIVATION_XP_MULTIPLIER is 2", () => {
    expect(REACTIVATION_XP_MULTIPLIER).toBe(2);
  });
});

describe("MentalSkill type shape", () => {
  it("can construct a valid MentalSkill object", () => {
    const skill: MentalSkill = {
      skillId: "ice_veins",
      rank: 2,
      xp: 150,
      xpToNextRank: 500,
      confidence: 75,
      lastTriggeredGame: 5,
      isActive: true,
      decayRate: DEFAULT_DECAY_RATE,
      wasLapsed: false,
    };
    expect(skill.skillId).toBe("ice_veins");
    expect(skill.rank).toBe(2);
    expect(skill.isActive).toBe(true);
    expect(skill.wasLapsed).toBe(false);
  });

  it("can construct a PhysicalPotential with valid tiers", () => {
    const potential: PhysicalPotential = {
      strength: 80,
      agility: 60,
      armStrength: 40,
      breakMastery: 100,
    };
    expect(potential.strength).toBe(80);
    expect(potential.agility).toBe(60);
  });
});
