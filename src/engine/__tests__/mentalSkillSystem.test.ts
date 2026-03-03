import { describe, it, expect } from "vitest";
import {
  discoverMentalSkill,
  grantMentalSkillXp,
  applyMentalSkillDecay,
  updateMentalSkillsPostGame,
  checkSkillTrigger,
  getMentalSkillBonus,
  getEligibleMentalSkills,
} from "@/engine/mentalSkillSystem";
import type { MentalSkillDiscoveryContext, PostGameMentalStats } from "@/engine/mentalSkillSystem";
import {
  MENTAL_SKILL_RANK_XP,
  CONFIDENCE_ACTIVE_THRESHOLD,
  DEFAULT_DECAY_RATE,
} from "@/types/mentalSkills";
import type { MentalSkill } from "@/types/mentalSkills";
import { mockBatter } from "./testHelpers";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function baseContext(overrides?: Partial<MentalSkillDiscoveryContext>): MentalSkillDiscoveryContext {
  return {
    playerAge: 28,
    gameNumber: 10,
    isHighLeverage: true,
    inning: 8,
    scoreDiff: 1,
    completeSeasonsPlayed: 2,
    ...overrides,
  };
}

function mockSkill(overrides?: Partial<MentalSkill>): MentalSkill {
  return {
    skillId: "ice_veins",
    rank: 1,
    xp: 0,
    xpToNextRank: MENTAL_SKILL_RANK_XP[1],
    confidence: 75,
    lastTriggeredGame: 5,
    isActive: true,
    decayRate: DEFAULT_DECAY_RATE,
    wasLapsed: false,
    ...overrides,
  };
}

// ─── discoverMentalSkill ──────────────────────────────────────────────────────

describe("discoverMentalSkill", () => {
  it("discovers ice_veins for player with Ice trait in high-leverage", () => {
    const player = mockBatter({ traits: ["Ice"] });
    const result = discoverMentalSkill(player, "ice_veins", baseContext());
    expect(result).not.toBeNull();
    expect(result?.skillId).toBe("ice_veins");
    expect(result?.rank).toBe(0);
    expect(result?.confidence).toBe(50);
  });

  it("returns null if player lacks the required trait", () => {
    const player = mockBatter({ traits: ["Muscle"] });
    const result = discoverMentalSkill(player, "ice_veins", baseContext());
    expect(result).toBeNull();
  });

  it("returns null if ice_veins context is not high-leverage", () => {
    const player = mockBatter({ traits: ["Ice"] });
    const result = discoverMentalSkill(
      player,
      "ice_veins",
      baseContext({ isHighLeverage: false })
    );
    expect(result).toBeNull();
  });

  it("returns null if player already has the skill", () => {
    const existingSkill = mockSkill({ skillId: "ice_veins" });
    const player = mockBatter({ traits: ["Ice"], mentalSkills: [existingSkill] });
    const result = discoverMentalSkill(player, "ice_veins", baseContext());
    expect(result).toBeNull();
  });

  it("discovers pitch_recognition with 15+ walks", () => {
    const player = mockBatter({ traits: ["Eye"] });
    const result = discoverMentalSkill(
      player,
      "pitch_recognition",
      baseContext({ seasonWalkCount: 15, isHighLeverage: false })
    );
    expect(result).not.toBeNull();
    expect(result?.skillId).toBe("pitch_recognition");
  });

  it("blocks pitch_recognition with < 15 walks and < 3 seasons", () => {
    const player = mockBatter({ traits: ["Eye"] });
    const result = discoverMentalSkill(
      player,
      "pitch_recognition",
      baseContext({ seasonWalkCount: 10, completeSeasonsPlayed: 2, isHighLeverage: false })
    );
    expect(result).toBeNull();
  });

  it("discovers pitch_recognition with 3 complete seasons even with few walks", () => {
    const player = mockBatter({ traits: ["Eye"] });
    const result = discoverMentalSkill(
      player,
      "pitch_recognition",
      baseContext({ seasonWalkCount: 5, completeSeasonsPlayed: 3, isHighLeverage: false })
    );
    expect(result).not.toBeNull();
  });

  it("discovers clutch_composure after redemption payoff in high-leverage", () => {
    const player = mockBatter({ traits: ["Heart"] });
    const result = discoverMentalSkill(
      player,
      "clutch_composure",
      baseContext({ hadRedemptionPayoff: true })
    );
    expect(result).not.toBeNull();
  });

  it("blocks clutch_composure without redemption payoff", () => {
    const player = mockBatter({ traits: ["Heart"] });
    const result = discoverMentalSkill(
      player,
      "clutch_composure",
      baseContext({ hadRedemptionPayoff: false })
    );
    expect(result).toBeNull();
  });

  it("discovers veteran_poise at age 31+", () => {
    const player = mockBatter({ traits: ["Wile"] });
    const result = discoverMentalSkill(
      player,
      "veteran_poise",
      baseContext({ playerAge: 32, isHighLeverage: false })
    );
    expect(result).not.toBeNull();
  });

  it("blocks veteran_poise at age < 31 with < 5 seasons", () => {
    const player = mockBatter({ traits: ["Wile"] });
    const result = discoverMentalSkill(
      player,
      "veteran_poise",
      baseContext({ playerAge: 28, completeSeasonsPlayed: 3, isHighLeverage: false })
    );
    expect(result).toBeNull();
  });

  it("discovers veteran_poise early with 5+ seasons despite young age", () => {
    const player = mockBatter({ traits: ["Wile"] });
    const result = discoverMentalSkill(
      player,
      "veteran_poise",
      baseContext({ playerAge: 27, completeSeasonsPlayed: 5, isHighLeverage: false })
    );
    expect(result).not.toBeNull();
  });

  it("discovers game_reading with 3+ complete seasons", () => {
    const player = mockBatter({ traits: ["Brain"] });
    const result = discoverMentalSkill(
      player,
      "game_reading",
      baseContext({ completeSeasonsPlayed: 3, isHighLeverage: false })
    );
    expect(result).not.toBeNull();
  });

  it("discovers game_reading with 3 consecutive successes vs same pitcher", () => {
    const player = mockBatter({ traits: ["Brain"] });
    const result = discoverMentalSkill(
      player,
      "game_reading",
      baseContext({ completeSeasonsPlayed: 1, beatSamePitcherCount: 3, isHighLeverage: false })
    );
    expect(result).not.toBeNull();
  });

  it("skill starts with discoveredAt set to gameNumber", () => {
    const player = mockBatter({ traits: ["Ice"] });
    const result = discoverMentalSkill(player, "ice_veins", baseContext({ gameNumber: 42 }));
    expect(result?.discoveredAt).toBe(42);
  });
});

// ─── grantMentalSkillXp ───────────────────────────────────────────────────────

describe("grantMentalSkillXp", () => {
  it("grants high-leverage XP (3) and boosts confidence", () => {
    const skill = mockSkill({ xp: 0, confidence: 50 });
    const result = grantMentalSkillXp(skill, true, 10);
    expect(result.xp).toBe(3);
    expect(result.confidence).toBeGreaterThan(50);
    expect(result.isActive).toBe(true);
  });

  it("grants normal XP (1) with smaller confidence boost", () => {
    const skill = mockSkill({ xp: 0, confidence: 50 });
    const result = grantMentalSkillXp(skill, false, 10);
    expect(result.xp).toBe(1);
  });

  it("ranks up when XP crosses threshold", () => {
    const threshold = MENTAL_SKILL_RANK_XP[1]; // 60
    const skill = mockSkill({ rank: 1, xp: threshold - 3 }); // 57 XP
    const result = grantMentalSkillXp(skill, true, 10); // +3 XP → 60 → rank up
    expect(result.rank).toBe(2);
    expect(result.xp).toBe(0); // XP resets after rank-up
  });

  it("does not exceed rank 5", () => {
    const skill = mockSkill({ rank: 5, xp: 0 });
    const result = grantMentalSkillXp(skill, true, 10);
    expect(result.rank).toBe(5);
  });

  it("grants 2x XP when wasLapsed is true", () => {
    const skill = mockSkill({ wasLapsed: true, xp: 0 });
    const normal = grantMentalSkillXp(mockSkill({ xp: 0 }), true, 10);
    const lapsed = grantMentalSkillXp(skill, true, 10);
    expect(lapsed.xp).toBeGreaterThan(normal.xp);
  });

  it("clears wasLapsed flag after gaining XP", () => {
    const skill = mockSkill({ wasLapsed: true, xp: 0 });
    const result = grantMentalSkillXp(skill, false, 10);
    expect(result.wasLapsed).toBe(false);
  });

  it("updates lastTriggeredGame", () => {
    const skill = mockSkill({ lastTriggeredGame: 1 });
    const result = grantMentalSkillXp(skill, true, 20);
    expect(result.lastTriggeredGame).toBe(20);
  });
});

// ─── applyMentalSkillDecay ────────────────────────────────────────────────────

describe("applyMentalSkillDecay", () => {
  it("reduces confidence by decayRate", () => {
    const skill = mockSkill({ confidence: 80, decayRate: DEFAULT_DECAY_RATE });
    const result = applyMentalSkillDecay(skill);
    expect(result.confidence).toBe(75);
  });

  it("does not go below 0", () => {
    const skill = mockSkill({ confidence: 3, decayRate: 10 });
    const result = applyMentalSkillDecay(skill);
    expect(result.confidence).toBe(0);
  });

  it("sets isActive false when confidence drops below threshold", () => {
    const skill = mockSkill({ confidence: CONFIDENCE_ACTIVE_THRESHOLD, decayRate: 5 });
    const result = applyMentalSkillDecay(skill);
    expect(result.confidence).toBe(CONFIDENCE_ACTIVE_THRESHOLD - 5);
    expect(result.isActive).toBe(false);
  });

  it("stays active if confidence stays above threshold", () => {
    const skill = mockSkill({ confidence: 50, decayRate: 5 });
    const result = applyMentalSkillDecay(skill);
    expect(result.isActive).toBe(true);
  });
});

// ─── updateMentalSkillsPostGame ───────────────────────────────────────────────

describe("updateMentalSkillsPostGame", () => {
  function baseStats(overrides?: Partial<PostGameMentalStats>): PostGameMentalStats {
    return {
      playerAge: 28,
      gameNumber: 15,
      highLeverageTriggered: [],
      normalTriggered: [],
      ...overrides,
    };
  }

  it("returns player unchanged if no mentalSkills", () => {
    const player = mockBatter({ mentalSkills: undefined });
    const result = updateMentalSkillsPostGame(player, baseStats());
    expect(result).toBe(player);
  });

  it("grants XP to high-leverage triggered skill", () => {
    const skill = mockSkill({ skillId: "ice_veins", xp: 0 });
    const player = mockBatter({ mentalSkills: [skill] });
    const result = updateMentalSkillsPostGame(
      player,
      baseStats({ highLeverageTriggered: ["ice_veins"] })
    );
    const updated = result.mentalSkills?.[0];
    expect(updated?.xp).toBeGreaterThan(0);
  });

  it("decays un-triggered skill", () => {
    const skill = mockSkill({ skillId: "ice_veins", confidence: 80 });
    const player = mockBatter({ mentalSkills: [skill] });
    const result = updateMentalSkillsPostGame(player, baseStats());
    const updated = result.mentalSkills?.[0];
    expect(updated?.confidence).toBeLessThan(80);
  });

  it("processes multiple skills independently", () => {
    const ice = mockSkill({ skillId: "ice_veins", confidence: 80 });
    const eye = mockSkill({ skillId: "pitch_recognition", confidence: 60 });
    const player = mockBatter({ mentalSkills: [ice, eye] });
    const result = updateMentalSkillsPostGame(
      player,
      baseStats({ normalTriggered: ["pitch_recognition"] })
    );
    const updatedIce = result.mentalSkills?.find((s) => s.skillId === "ice_veins");
    const updatedEye = result.mentalSkills?.find((s) => s.skillId === "pitch_recognition");
    expect(updatedIce?.confidence).toBeLessThan(80); // decayed
    expect(updatedEye?.confidence).toBeGreaterThanOrEqual(60); // triggered, boosted
  });
});

// ─── checkSkillTrigger ────────────────────────────────────────────────────────

describe("checkSkillTrigger", () => {
  it("ice_veins triggers in high-leverage, close game", () => {
    expect(checkSkillTrigger("ice_veins", { isHighLeverage: true, inning: 9, scoreDiff: 1 })).toBe(true);
  });

  it("ice_veins does not trigger when score diff > 2", () => {
    expect(checkSkillTrigger("ice_veins", { isHighLeverage: true, inning: 9, scoreDiff: 5 })).toBe(false);
  });

  it("pitch_recognition triggers on contact approach", () => {
    expect(checkSkillTrigger("pitch_recognition", { isHighLeverage: false, inning: 3, scoreDiff: 2, batterApproach: "contact" })).toBe(true);
  });

  it("pitch_recognition triggers on walk outcome", () => {
    expect(checkSkillTrigger("pitch_recognition", { isHighLeverage: false, inning: 5, scoreDiff: 3, outcome: "walk" })).toBe(true);
  });

  it("veteran_poise triggers in inning 7+", () => {
    expect(checkSkillTrigger("veteran_poise", { isHighLeverage: false, inning: 7, scoreDiff: 4 })).toBe(true);
    expect(checkSkillTrigger("veteran_poise", { isHighLeverage: false, inning: 6, scoreDiff: 4 })).toBe(false);
  });

  it("game_reading does not trigger on strikeout", () => {
    expect(checkSkillTrigger("game_reading", { isHighLeverage: false, inning: 4, scoreDiff: 2, outcome: "strikeout" })).toBe(false);
  });

  it("game_reading triggers on non-strikeout outcomes", () => {
    expect(checkSkillTrigger("game_reading", { isHighLeverage: false, inning: 4, scoreDiff: 2, outcome: "single" })).toBe(true);
  });
});

// ─── getMentalSkillBonus ─────────────────────────────────────────────────────

describe("getMentalSkillBonus", () => {
  it("inactive skill contributes 0 bonus", () => {
    const skill = mockSkill({ isActive: false, rank: 5 });
    expect(getMentalSkillBonus(skill)).toBe(0);
  });

  it("rank 0 active skill gives 0 bonus regardless of confidence", () => {
    const skill = mockSkill({ rank: 0, confidence: 100, isActive: true });
    expect(getMentalSkillBonus(skill)).toBe(0);
  });

  it("rank 5 at full confidence gives maximum bonus (13)", () => {
    const skill = mockSkill({ rank: 5, confidence: 100, isActive: true });
    expect(getMentalSkillBonus(skill)).toBe(13);
  });

  it("confidence scales the bonus (50% confidence → ~50% bonus)", () => {
    const skill = mockSkill({ rank: 5, confidence: 50, isActive: true });
    expect(getMentalSkillBonus(skill)).toBeCloseTo(7, 0);
  });
});

// ─── getEligibleMentalSkills ─────────────────────────────────────────────────

describe("getEligibleMentalSkills", () => {
  it("returns skills for all matching traits", () => {
    const player = mockBatter({ traits: ["Ice", "Eye"] });
    const eligible = getEligibleMentalSkills(player);
    expect(eligible).toContain("ice_veins");
    expect(eligible).toContain("pitch_recognition");
  });

  it("excludes already-discovered skills", () => {
    const ice = mockSkill({ skillId: "ice_veins" });
    const player = mockBatter({ traits: ["Ice", "Eye"], mentalSkills: [ice] });
    const eligible = getEligibleMentalSkills(player);
    expect(eligible).not.toContain("ice_veins");
    expect(eligible).toContain("pitch_recognition");
  });

  it("returns empty when no matching traits", () => {
    const player = mockBatter({ traits: ["Muscle", "Fire"] });
    const eligible = getEligibleMentalSkills(player);
    expect(eligible).toHaveLength(0);
  });
});
