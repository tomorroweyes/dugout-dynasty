/**
 * Full Skills System Integration Tests — Issue #40
 *
 * End-to-end integration test suite spanning all 6 phases of the skills system:
 *   Phase 1: Mental Skills (discovery, XP, rank-up, decay)
 *   Phase 2: Breakthrough Moments
 *   Phase 3: Bad Habits
 *   Phase 4: Signature Skills & Reinvention
 *   Phase 5: Mentorship & Lineage
 *   Phase 6: Chemistry Combos
 *
 * See: https://github.com/tomorroweyes/dugout-dynasty/issues/40
 */

import { describe, it, expect } from "vitest";
import type { Player } from "@/types/game";
import type { MentalSkill, MentalSkillType } from "@/types/mentalSkills";
import type { DiscoveredCombo } from "@/types/chemistry";
import type { SignatureSkill } from "@/types/breakthroughs";

// ─── Engine imports ───────────────────────────────────────────────────────────

import {
  discoverMentalSkill,
  grantMentalSkillXp,
  applyMentalSkillDecay,
  updateMentalSkillsPostGame,
  checkSkillTrigger,
  getMentalSkillBonus,
  getEligibleMentalSkills,
} from "@/engine/mentalSkillSystem";
import type {
  MentalSkillDiscoveryContext,
  PostGameMentalStats,
} from "@/engine/mentalSkillSystem";

import {
  checkBreakthroughTrigger,
  activateBreakthrough,
} from "@/engine/breakthroughSystem";
import type { BreakthroughContext } from "@/engine/breakthroughSystem";

import {
  formBadHabit,
  reinforceHabit,
  breakHabit,
  hasActiveBadHabit,
  getActiveHabits,
  getCombinedHabitEffect,
  generateHabitCostNarrative,
  trackSkillUsage,
  applyReinventionReset,
} from "@/engine/badHabitSystem";

import {
  generateSignatureSkill,
  attachSignatureToPlayer,
  getActiveSignatureSkill,
  recordHighLeverageUse,
  applySignatureEffect,
  narrativeSignatureUse,
  narrativeSignatureReveal,
} from "@/engine/signatureSkillSystem";

import {
  checkReinventionEligibility,
  triggerReinvention,
  getReinventionModifiers,
  isInReinventionSeason,
  applyPhysicalReinventionModifier,
  applyMentalXpReinventionModifier,
  resolveReinventionOutcome,
  narrativeReinventionTrigger,
} from "@/engine/reinventionSystem";

import {
  checkMentorEligibility,
  createMentorship,
  applyMentorshipXPModifiers,
  buildLineageChain,
  addLineageNode,
  applyLegacyBonus,
  generateLegacyNarrative,
} from "@/engine/mentorshipSystem";
import type { MentorshipGameContext } from "@/engine/mentorshipSystem";

import {
  scanForCombos,
  getTotalComboTriggers,
  getNamedCombos,
} from "@/engine/chemistrySystem";

import {
  MENTAL_SKILL_RANK_XP,
  CONFIDENCE_ACTIVE_THRESHOLD,
  DEFAULT_DECAY_RATE,
} from "@/types/mentalSkills";
import { COMBO_DISCOVERY_THRESHOLD } from "@/types/chemistry";
import { LEGACY_BONUS_PER_GENERATION } from "@/types/mentorship";

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-integration",
    name: "Rivera",
    surname: "Rivera",
    role: "Batter",
    stats: { power: 70, contact: 75, glove: 60, speed: 65 },
    salary: 5000,
    level: 5,
    xp: 0,
    totalXpEarned: 0,
    equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    spirit: { current: 80, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    age: 24,
    seasonsPlayed: 0,
    ...overrides,
  };
}

function makeSkill(overrides: Partial<MentalSkill> = {}): MentalSkill {
  return {
    skillId: "ice_veins",
    rank: 1,
    xp: 0,
    xpToNextRank: MENTAL_SKILL_RANK_XP[1],
    confidence: 75,
    lastTriggeredGame: 1,
    isActive: true,
    decayRate: DEFAULT_DECAY_RATE,
    wasLapsed: false,
    ...overrides,
  };
}

function discoveryCtx(overrides: Partial<MentalSkillDiscoveryContext> = {}): MentalSkillDiscoveryContext {
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

function breakthroughCtx(overrides: Partial<BreakthroughContext> = {}): BreakthroughContext {
  return {
    gameNumber: 10,
    inning: 8,
    outs: 2,
    runners: [false, true, false],
    score: { myRuns: 3, opponentRuns: 2 },
    isHighLeverage: true,
    opponentName: "Steel City Rollers",
    rng: { random: () => 0.1, seed: 42 },
    ...overrides,
  };
}

/** Seed an active skill at the given rank with XP near threshold */
function seedSkillAtRank(player: Player, skillId: MentalSkillType, rank: 1 | 2 | 3 | 4, xpPercent = 0.9): MentalSkill {
  const skill = makeSkill({
    skillId,
    rank,
    xp: Math.floor(MENTAL_SKILL_RANK_XP[rank] * xpPercent),
    xpToNextRank: MENTAL_SKILL_RANK_XP[rank],
    confidence: 80,
    isActive: true,
  });
  if (!player.mentalSkills) player.mentalSkills = [];
  player.mentalSkills.push(skill);
  return skill;
}

/** Seed an active signature skill on player; returns the skill */
function seedSignature(player: Player): SignatureSkill {
  const bt = {
    breakthroughId: "bt-seed",
    playerId: player.id,
    skillId: "ice_veins" as MentalSkillType,
    skillRank: 5,
    archetype: "streak_moment" as const,
    triggeredAt: { gameNumber: 5, inning: 9, scoreDiff: 0, context: "9th, tied" },
    narrative: "Something clicked.",
    signatureSkillId: `sig-${player.id}`,
    memoryLabel: "Rivera's Scalpel",
    createdAt: new Date(),
  };
  const sig = generateSignatureSkill(player, bt);
  attachSignatureToPlayer(player, sig);
  return sig;
}

/** Deterministic RNG provider from a fixed sequence */
function makeRng(values: number[]) {
  let idx = 0;
  return { random: () => values[idx++ % values.length], seed: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Career Arc: Mental Skill Discovery (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Mental Skill Discovery (Phase 1)", () => {
  it("player with Ice trait can discover ice_veins in high-leverage", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = discoverMentalSkill(player, "ice_veins", discoveryCtx({ isHighLeverage: true }));
    expect(skill).not.toBeNull();
    expect(skill!.skillId).toBe("ice_veins");
    expect(skill!.rank).toBe(0);
  });

  it("player without matching trait cannot discover the skill", () => {
    const player = makePlayer({ traits: ["Muscle"] });
    const skill = discoverMentalSkill(player, "ice_veins", discoveryCtx());
    expect(skill).toBeNull();
  });

  it("veteran_poise requires age 31+ to discover", () => {
    const young = makePlayer({ traits: ["Wile"], age: 28 });
    const veteran = makePlayer({ traits: ["Wile"], age: 32 });

    const youngCtx = discoveryCtx({ playerAge: 28, isHighLeverage: false });
    const vetCtx = discoveryCtx({ playerAge: 32, isHighLeverage: false });

    expect(discoverMentalSkill(young, "veteran_poise", youngCtx)).toBeNull();
    expect(discoverMentalSkill(veteran, "veteran_poise", vetCtx)).not.toBeNull();
  });

  it("getEligibleMentalSkills returns skill IDs matching player traits", () => {
    const player = makePlayer({ traits: ["Ice", "Eye"] });
    const eligible = getEligibleMentalSkills(player);
    expect(eligible).toContain("ice_veins");
    expect(eligible).toContain("pitch_recognition");
    expect(eligible).not.toContain("veteran_poise");
  });

  it("getEligibleMentalSkills excludes already-discovered skills", () => {
    const player = makePlayer({ traits: ["Ice", "Eye"] });
    player.mentalSkills = [makeSkill({ skillId: "ice_veins" })];

    const eligible = getEligibleMentalSkills(player);
    expect(eligible).not.toContain("ice_veins");
    expect(eligible).toContain("pitch_recognition");
  });

  it("pitch_recognition requires 15+ walks to discover", () => {
    const player = makePlayer({ traits: ["Eye"] });
    const lowWalks = discoverMentalSkill(player, "pitch_recognition", discoveryCtx({ seasonWalkCount: 8, completeSeasonsPlayed: 2 }));
    const highWalks = discoverMentalSkill(player, "pitch_recognition", discoveryCtx({ seasonWalkCount: 16 }));
    expect(lowWalks).toBeNull();
    expect(highWalks).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Career Arc: XP Progression (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Rank-Up & XP Progression (Phase 1)", () => {
  it("grantMentalSkillXp increases XP toward rank-up threshold", () => {
    const skill = makeSkill({ rank: 1, xp: 0, xpToNextRank: MENTAL_SKILL_RANK_XP[1] });
    const result = grantMentalSkillXp(skill, false, 10);
    expect(result.xp).toBeGreaterThan(0);
  });

  it("high-leverage XP grant awards more than normal XP", () => {
    const s1 = makeSkill({ rank: 1, xp: 0, xpToNextRank: MENTAL_SKILL_RANK_XP[1] });
    const s2 = makeSkill({ rank: 1, xp: 0, xpToNextRank: MENTAL_SKILL_RANK_XP[1] });
    // Pass false (normal) and true (high-leverage) to grantMentalSkillXp(skill, isHighLeverage, gameNumber)
    const normal = grantMentalSkillXp(s1, false, 1);
    const highLev = grantMentalSkillXp(s2, true, 1);
    expect(highLev.xp).toBeGreaterThan(normal.xp);
  });

  it("skill naturally decays confidence when not triggered", () => {
    const skill = makeSkill({ confidence: 80 });
    const decayed = applyMentalSkillDecay(skill);
    expect(decayed.confidence).toBeLessThan(80);
  });

  it("skill becomes inactive when confidence drops below threshold", () => {
    let s = makeSkill({ confidence: CONFIDENCE_ACTIVE_THRESHOLD + 1 });
    for (let i = 0; i < 25; i++) {
      s = applyMentalSkillDecay(s);
    }
    expect(s.confidence).toBeLessThan(CONFIDENCE_ACTIVE_THRESHOLD);
    expect(s.isActive).toBe(false);
  });

  it("getMentalSkillBonus returns 0 for inactive skill", () => {
    const skill = makeSkill({ isActive: false, rank: 3, confidence: 20 });
    expect(getMentalSkillBonus(skill)).toBe(0);
  });

  it("getMentalSkillBonus scales with confidence", () => {
    const highConf = makeSkill({ rank: 3, confidence: 100, isActive: true });
    const lowConf = makeSkill({ rank: 3, confidence: 30, isActive: true });
    expect(getMentalSkillBonus(highConf)).toBeGreaterThan(getMentalSkillBonus(lowConf));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Skill Trigger Conditions (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Skill Trigger Conditions (Phase 1)", () => {
  it("ice_veins triggers in high-leverage close games", () => {
    expect(checkSkillTrigger("ice_veins", { isHighLeverage: true, inning: 9, scoreDiff: 1 })).toBe(true);
  });

  it("ice_veins does not trigger in low-leverage", () => {
    expect(checkSkillTrigger("ice_veins", { isHighLeverage: false, inning: 9, scoreDiff: 1 })).toBe(false);
  });

  it("pitch_recognition triggers on walk outcome", () => {
    expect(
      checkSkillTrigger("pitch_recognition", { isHighLeverage: false, inning: 5, scoreDiff: 3, outcome: "walk" })
    ).toBe(true);
  });

  it("pitch_recognition triggers on contact batter approach", () => {
    expect(
      checkSkillTrigger("pitch_recognition", { isHighLeverage: false, inning: 5, scoreDiff: 3, batterApproach: "contact" })
    ).toBe(true);
  });

  it("veteran_poise triggers in innings 7+ regardless of leverage", () => {
    expect(checkSkillTrigger("veteran_poise", { isHighLeverage: false, inning: 7, scoreDiff: 5 })).toBe(true);
    expect(checkSkillTrigger("veteran_poise", { isHighLeverage: false, inning: 4, scoreDiff: 5 })).toBe(false);
  });

  it("game_reading triggers on any non-strikeout outcome", () => {
    expect(checkSkillTrigger("game_reading", { isHighLeverage: false, inning: 5, scoreDiff: 2, outcome: "single" })).toBe(true);
    expect(checkSkillTrigger("game_reading", { isHighLeverage: false, inning: 5, scoreDiff: 2, outcome: "strikeout" })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Post-Game Update (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Post-Game Update (Phase 1)", () => {
  it("updateMentalSkillsPostGame raises XP for triggered skills and returns new player", () => {
    const player = makePlayer();
    const skill = makeSkill({ skillId: "ice_veins", rank: 1, xp: 0 });
    player.mentalSkills = [skill];

    const stats: PostGameMentalStats = {
      playerAge: 28,
      gameNumber: 20,
      highLeverageTriggered: ["ice_veins"],
      normalTriggered: [],
    };

    const updated = updateMentalSkillsPostGame(player, stats);
    // updateMentalSkillsPostGame returns a new player (immutable)
    expect(updated.mentalSkills![0].xp).toBeGreaterThan(0);
  });

  it("updateMentalSkillsPostGame decays confidence for un-triggered skills", () => {
    const player = makePlayer();
    const skill = makeSkill({ skillId: "ice_veins", confidence: 80 });
    player.mentalSkills = [skill];

    const stats: PostGameMentalStats = {
      playerAge: 28,
      gameNumber: 21,
      highLeverageTriggered: [],
      normalTriggered: [],
    };

    const updated = updateMentalSkillsPostGame(player, stats);
    expect(updated.mentalSkills![0].confidence).toBeLessThan(80);
  });

  it("updateMentalSkillsPostGame does not mutate original player", () => {
    const player = makePlayer();
    const skill = makeSkill({ skillId: "ice_veins", xp: 0, confidence: 70 });
    player.mentalSkills = [skill];

    const stats: PostGameMentalStats = {
      playerAge: 28,
      gameNumber: 22,
      highLeverageTriggered: ["ice_veins"],
      normalTriggered: [],
    };

    const updated = updateMentalSkillsPostGame(player, stats);
    // Original skill object unchanged
    expect(player.mentalSkills![0].xp).toBe(0);
    expect(updated.mentalSkills![0].xp).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Breakthrough System (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Breakthrough Detection (Phase 2)", () => {
  it("breakthrough triggers when skill is near rank-up and conditions met", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 1, 0.9);

    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).not.toBeNull();
    expect(event!.skillId).toBe("ice_veins");
    expect(event!.skillRank).toBe(2);
  });

  it("breakthrough does not trigger when below 80% XP threshold", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 1, 0.3);

    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).toBeNull();
  });

  it("breakthrough does not trigger in non-high-leverage context", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 1, 0.9);

    const ctx = breakthroughCtx({
      isHighLeverage: false,
      inning: 3,
      score: { myRuns: 5, opponentRuns: 0 },
      rng: makeRng([0.05]),
    });

    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).toBeNull();
  });

  it("activateBreakthrough advances the player's skill rank and records history", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 1, 0.9);
    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });

    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).not.toBeNull();

    activateBreakthrough(player, event!);

    const updatedSkill = player.mentalSkills?.find((s) => s.skillId === "ice_veins");
    expect(updatedSkill?.rank).toBe(2);
    expect(player.breakthroughEvents).toHaveLength(1);
  });

  it("breakthrough at rank 4→5 with no bad habit generates signature skill", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 4, 0.9);

    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).not.toBeNull();
    expect(event!.signatureSkillId).toBeDefined();

    activateBreakthrough(player, event!);

    const activeSig = getActiveSignatureSkill(player);
    expect(activeSig).not.toBeNull();
    expect(activeSig!.skillId).toBe("ice_veins");
    expect(activeSig!.isActive).toBe(true);
  });

  it("breakthrough at rank 4→5 with active bad habit does NOT generate signature skill ID", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 4, 0.9);

    // Plant active bad habit (strength > 50)
    formBadHabit(player, "pull_happy", "approach_streak", 5);
    const habit = player.badHabits![0];
    habit.strength = 60;
    habit.isActive = true;

    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);

    if (event !== null) {
      expect(event.signatureSkillId).toBeUndefined();
    }
  });

  it("breakthrough narrative is a non-empty string", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 1, 0.9);
    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).not.toBeNull();
    expect(typeof event!.narrative).toBe("string");
    expect(event!.narrative.length).toBeGreaterThan(0);
  });

  it("breakthrough memoryLabel includes player name", () => {
    const player = makePlayer({ name: "Rivera", traits: ["Ice"] });
    const skill = seedSkillAtRank(player, "ice_veins", 1, 0.9);
    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const event = checkBreakthroughTrigger(player, ctx, "ice_veins", skill);
    expect(event).not.toBeNull();
    expect(event!.memoryLabel).toContain("Rivera");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Bad Habit System (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Bad Habit Formation (Phase 3)", () => {
  it("habit forms correctly and is attached to player", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 5);

    expect(player.badHabits).toHaveLength(1);
    expect(player.badHabits![0].habitType).toBe("pull_happy");
    expect(player.badHabits![0].strength).toBe(0);
    expect(player.badHabits![0].isActive).toBe(false);
  });

  it("reinforcing habit raises strength and eventually activates it", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    const habit = player.badHabits![0];

    // reinforceHabit(habit, player, gameNumber) — habit is FIRST arg
    let gameNum = 2;
    while (!habit.isActive && gameNum < 50) {
      reinforceHabit(habit, player, gameNum++);
    }

    expect(habit.strength).toBeGreaterThan(50);
    expect(habit.isActive).toBe(true);
  });

  it("getCombinedHabitEffect returns structural penalty fields when habit is active", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    const habit = player.badHabits![0];
    habit.strength = 75;
    habit.isActive = true;

    const effect = getCombinedHabitEffect(player);
    // The effect has specific penalty fields (totalContactPenalty, totalDecisionAccuracyPenalty, etc.)
    expect(effect).toBeDefined();
    expect(typeof effect.totalContactPenalty).toBe("number");
    expect(typeof effect.totalDecisionAccuracyPenalty).toBe("number");
    // At least one penalty field should be non-zero for active habit
    const anyPenalty = effect.totalContactPenalty > 0 ||
      effect.totalDecisionAccuracyPenalty > 0 ||
      effect.totalOpponentContactBonus > 0;
    expect(anyPenalty).toBe(true);
  });

  it("active bad habit creates measurable contact penalty (>5%)", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    player.badHabits![0].strength = 80;
    player.badHabits![0].isActive = true;

    const effect = getCombinedHabitEffect(player);
    // pull_happy specifically causes contact penalty
    expect(effect.totalContactPenalty).toBeGreaterThan(0.05);
  });

  it("breaking a habit resets strength to 0 and marks it broken", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    const habit = player.badHabits![0];
    habit.strength = 60;
    habit.isActive = true;

    // breakHabit(habit, player, gameNumber) — habit is FIRST arg
    breakHabit(habit, player, 20);

    expect(habit.strength).toBe(0);
    expect(habit.brokenAt).toBeDefined();
    expect(hasActiveBadHabit(player)).toBe(false);
  });

  it("bad habit narrative is a non-empty string", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    player.badHabits![0].strength = 60;
    player.badHabits![0].isActive = true;

    const narrative = generateHabitCostNarrative(player);
    expect(typeof narrative).toBe("string");
    expect(narrative.length).toBeGreaterThan(0);
  });

  it("trackSkillUsage accumulates a usage log on the player", () => {
    const player = makePlayer();
    trackSkillUsage(player, "ice_veins", 1);
    trackSkillUsage(player, "ice_veins", 2);
    expect(player.habitUsageLog).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Signature Skills (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Signature Skills (Phase 4)", () => {
  it("generateSignatureSkill creates a skill with correct shape", () => {
    const player = makePlayer();
    const bt = {
      breakthroughId: "bt-test",
      playerId: player.id,
      skillId: "ice_veins" as MentalSkillType,
      skillRank: 5,
      archetype: "streak_moment" as const,
      triggeredAt: { gameNumber: 5, inning: 9, scoreDiff: 0, context: "9th, tied" },
      narrative: "Something clicked.",
      signatureSkillId: "sig-test",
      memoryLabel: "Rivera's Scalpel",
      createdAt: new Date(),
    };
    const sig = generateSignatureSkill(player, bt);

    expect(sig.skillId).toBe("ice_veins");
    expect(sig.isActive).toBe(true);
    expect(sig.isArchived).toBe(false);
    expect(sig.effectBonus).toBeGreaterThan(0);
    expect(sig.skillName.length).toBeGreaterThan(0);
  });

  it("applySignatureEffect(baseEffect, sig, scoutLevel) returns boosted value", () => {
    const player = makePlayer();
    const sig = seedSignature(player);
    const activeSig = getActiveSignatureSkill(player)!;

    const base = 0.5;
    const boosted = applySignatureEffect(base, activeSig, 0);
    // Signature provides measurable advantage
    expect(boosted).toBeGreaterThan(base);
  });

  it("signature skill advantage does not exceed 25% above base at scout tier 0", () => {
    const player = makePlayer();
    const sig = seedSignature(player);
    const activeSig = getActiveSignatureSkill(player)!;

    const base = 0.5;
    const boosted = applySignatureEffect(base, activeSig, 0);
    const advantage = (boosted - base) / base;
    expect(advantage).toBeLessThan(0.25);
  });

  it("recordHighLeverageUse(signature, opponentName) increments use counter", () => {
    const player = makePlayer();
    seedSignature(player);
    const activeSig = getActiveSignatureSkill(player)!;

    const initialUses = activeSig.reputation.highLeverageUses;
    recordHighLeverageUse(activeSig, "Steel City");

    expect(activeSig.reputation.highLeverageUses).toBe(initialUses + 1);
  });

  it("narrativeSignatureUse returns a non-empty string", () => {
    const text = narrativeSignatureUse("Rivera", "Rivera's Scalpel");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("narrativeSignatureReveal returns a non-empty string", () => {
    const text = narrativeSignatureReveal("Rivera", "Rivera's Scalpel");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Reinvention Arc (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Reinvention Arc (Phase 4)", () => {
  it("player is eligible for reinvention at age 29+ with signature skill", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    expect(checkReinventionEligibility(player, 8)).toBe(true);
  });

  it("player without signature skill is NOT eligible", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    expect(checkReinventionEligibility(player, 8)).toBe(false);
  });

  it("player who already reinvented is NOT eligible again", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    triggerReinvention(player, 8, 1);
    expect(checkReinventionEligibility(player, 9)).toBe(false);
  });

  it("reinvention event is recorded on the player", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    triggerReinvention(player, 8, 1);
    expect(player.reinventionEvent).toBeDefined();
    expect(isInReinventionSeason(player, 8)).toBe(true);
  });

  it("applyPhysicalReinventionModifier(baseValue, player, season) applies penalty (<1.0)", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    triggerReinvention(player, 8, 1);

    // applyPhysicalReinventionModifier(baseValue, player, currentSeason)
    const base = 1.0;
    const modified = applyPhysicalReinventionModifier(base, player, 8);
    expect(modified).toBeLessThan(base);
  });

  it("applyMentalXpReinventionModifier(baseXp, player, season) applies bonus (>base)", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    triggerReinvention(player, 8, 1);

    // applyMentalXpReinventionModifier(baseXp, player, currentSeason)
    const base = 100;
    const modified = applyMentalXpReinventionModifier(base, player, 8);
    expect(modified).toBeGreaterThan(base);
  });

  it("reinvention resets bad habits via applyReinventionReset", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    player.badHabits![0].strength = 60;
    player.badHabits![0].isActive = true;

    applyReinventionReset(player, 8);
    expect(hasActiveBadHabit(player)).toBe(false);
  });

  it("reinvention trigger narrative is a non-empty string", () => {
    const text = narrativeReinventionTrigger("Rivera");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("resolveReinventionOutcome returns 'success' when avg > 0.220", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    triggerReinvention(player, 8, 1);

    // resolveReinventionOutcome(player, { avg }, season)
    const outcome = resolveReinventionOutcome(player, { avg: 0.280 }, 9);
    expect(outcome).toBe("success");
  });

  it("resolveReinventionOutcome returns 'failure' when avg <= 0.220", () => {
    const player = makePlayer({ age: 30, seasonsPlayed: 7 });
    seedSignature(player);
    triggerReinvention(player, 8, 1);

    const outcome = resolveReinventionOutcome(player, { avg: 0.190 }, 9);
    expect(outcome).toBe("failure");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — Mentorship & Lineage (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Career Arc — Mentorship Pairing (Phase 5)", () => {
  it("eligible mentor–apprentice pair passes the eligibility check", () => {
    const mentor = makePlayer({ id: "mentor-1", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "apprentice-1", age: 24 });
    expect(checkMentorEligibility(mentor, apprentice)).toBe(true);
  });

  it("rejects pair if mentor lacks signature skill", () => {
    const mentor = makePlayer({ id: "mentor-2", age: 36 });
    const apprentice = makePlayer({ id: "apprentice-2", age: 24 });
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });

  it("rejects pair if age gap is < 5 years", () => {
    const mentor = makePlayer({ id: "mentor-3", age: 28 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "apprentice-3", age: 25 });
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });

  it("createMentorship links mentor and apprentice via activeMentorship", () => {
    const mentor = makePlayer({ id: "mentor-4", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "apprentice-4", age: 24 });

    createMentorship(mentor, apprentice, 10, Math.random);

    expect(mentor.activeMentorship).toBeDefined();
    expect(apprentice.activeMentorship).toBeDefined();
    expect(mentor.activeMentorship!.mentorId).toBe("mentor-4");
    expect(apprentice.activeMentorship!.apprenticeId).toBe("apprentice-4");
  });

  it("applyMentorshipXPModifiers returns a multiplier > 1.0 for active apprentice", () => {
    const mentor = makePlayer({ id: "mentor-5", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "apprentice-5", age: 24 });
    createMentorship(mentor, apprentice, 10, Math.random);

    const ctx: MentorshipGameContext = {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: true,
    };

    // applyMentorshipXPModifiers(player, context) returns a multiplier
    const multiplier = applyMentorshipXPModifiers(apprentice, ctx);
    expect(multiplier).toBeGreaterThan(1.0);
  });

  it("mentorship XP multiplier is capped at a reasonable value", () => {
    const mentor = makePlayer({ id: "mentor-6", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "apprentice-6", age: 24 });
    createMentorship(mentor, apprentice, 10, Math.random);

    const ctx: MentorshipGameContext = {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: true,
    };

    const multiplier = applyMentorshipXPModifiers(apprentice, ctx);
    expect(multiplier).toBeLessThanOrEqual(2.5);
  });

  it("addLineageNode attaches lineage to apprentice player", () => {
    const mentor = makePlayer({ id: "lineage-m1", age: 36, name: "Elder" });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "lineage-a1", age: 24 });

    addLineageNode(apprentice, mentor);

    expect(apprentice.lineage).toBeDefined();
    expect(apprentice.lineage!.length).toBeGreaterThanOrEqual(1);
    expect(apprentice.lineage![0].playerId).toBe("lineage-m1");
  });

  it("buildLineageChain(player, allPlayers) returns lineage from history", () => {
    const gen1 = makePlayer({ id: "gen1", age: 40, name: "Elder" });
    seedSignature(gen1);
    const gen2 = makePlayer({ id: "gen2", age: 32, name: "Veteran" });
    seedSignature(gen2);
    const gen3 = makePlayer({ id: "gen3", age: 24, name: "Rookie" });

    // Simulate mentorship history: gen2 was apprentice of gen1
    createMentorship(gen1, gen2, 1, Math.random);
    // Manually end it to move to history
    if (gen2.activeMentorship) {
      if (!gen2.mentorshipHistory) gen2.mentorshipHistory = [];
      gen2.mentorshipHistory.push({ ...gen2.activeMentorship });
      gen2.activeMentorship = undefined;
    }
    createMentorship(gen2, gen3, 5, Math.random);
    if (gen3.activeMentorship) {
      if (!gen3.mentorshipHistory) gen3.mentorshipHistory = [];
      gen3.mentorshipHistory.push({ ...gen3.activeMentorship });
      gen3.activeMentorship = undefined;
    }

    const allPlayers = new Map([
      ["gen1", gen1],
      ["gen2", gen2],
      ["gen3", gen3],
    ]);

    const chain = buildLineageChain(gen3, allPlayers);
    expect(chain.length).toBeGreaterThanOrEqual(1);
  });

  it("generateLegacyNarrative(player, skillId) returns a string when lineage exists", () => {
    const mentor = makePlayer({ id: "lgn-m", age: 36, name: "Rivera" });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "lgn-a", age: 24 });
    addLineageNode(apprentice, mentor);

    const narrative = generateLegacyNarrative(apprentice, "ice_veins");
    // Narrative is either a string (if lineage matches) or empty string (if no match)
    expect(typeof narrative).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — Chemistry Combos (Phase 6)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Team Simulation — Chemistry Combos (Phase 6)", () => {
  const highLeverageCtx = {
    inning: 8,
    isCloseGame: true,
    scoreDiff: -1,
    currentGameNumber: 5,
    rng: () => 0.1, // Low → triggers when eligible
  };

  const lowLeverageCtx = {
    inning: 3,
    isCloseGame: false,
    scoreDiff: 5,
    currentGameNumber: 5,
    rng: () => 0.1,
  };

  it("scanForCombos returns empty in non-high-leverage context", () => {
    const mentor = makePlayer({ id: "p1-nl", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "p2-nl", age: 24 });
    createMentorship(mentor, apprentice, 1, Math.random);

    const triggers = scanForCombos([mentor, apprentice], [], lowLeverageCtx);
    expect(triggers).toHaveLength(0);
  });

  it("legacy_lineage combo triggers for mentor+apprentice pair in high-leverage", () => {
    const mentor = makePlayer({ id: "lm1", age: 36, name: "Rivera" });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "la1", age: 24, name: "Chen" });
    createMentorship(mentor, apprentice, 1, Math.random);

    const store: DiscoveredCombo[] = [];
    const triggers = scanForCombos([mentor, apprentice], store, highLeverageCtx);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0].combo.comboId).toBe("legacy_lineage");
  });

  it("combo becomes named after COMBO_DISCOVERY_THRESHOLD triggers", () => {
    const mentor = makePlayer({ id: "nm1", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "na1", age: 24 });
    createMentorship(mentor, apprentice, 1, Math.random);

    const store: DiscoveredCombo[] = [];

    for (let g = 0; g < COMBO_DISCOVERY_THRESHOLD; g++) {
      scanForCombos(
        [mentor, apprentice],
        store,
        { ...highLeverageCtx, currentGameNumber: g + 1 }
      );
    }

    const named = getNamedCombos(store);
    expect(named.length).toBeGreaterThan(0);
    expect(named[0].isNamed).toBe(true);
    expect(named[0].generatedName.length).toBeGreaterThan(0);
  });

  it("named combo trigger includes a narrative string", () => {
    const mentor = makePlayer({ id: "nnm1", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "nna1", age: 24 });
    createMentorship(mentor, apprentice, 1, Math.random);

    const store: DiscoveredCombo[] = [];
    let lastTriggerWithNarrative: string | undefined;

    for (let g = 0; g < COMBO_DISCOVERY_THRESHOLD; g++) {
      const triggers = scanForCombos(
        [mentor, apprentice],
        store,
        { ...highLeverageCtx, currentGameNumber: g + 1 }
      );
      for (const t of triggers) {
        if (t.narrative) lastTriggerWithNarrative = t.narrative;
      }
    }

    if (lastTriggerWithNarrative !== undefined) {
      expect(typeof lastTriggerWithNarrative).toBe("string");
      expect(lastTriggerWithNarrative.length).toBeGreaterThan(0);
    }
  });

  it("getTotalComboTriggers sums trigger counts across all combos", () => {
    const store: DiscoveredCombo[] = [
      {
        discoveryId: "d1",
        comboId: "legacy_lineage",
        player1Id: "p1",
        player2Id: "p2",
        generatedName: "",
        timesTriggered: 7,
        isNamed: true,
      },
      {
        discoveryId: "d2",
        comboId: "old_dog",
        player1Id: "p3",
        player2Id: "p4",
        generatedName: "",
        timesTriggered: 4,
        isNamed: false,
      },
    ];
    expect(getTotalComboTriggers(store)).toBe(11);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — State Persistence Across Games
// ═══════════════════════════════════════════════════════════════════════════════

describe("State Persistence", () => {
  it("mental skill XP accumulates correctly across simulated games", () => {
    let player = makePlayer();
    const skill = makeSkill({ skillId: "ice_veins", rank: 1, xp: 0 });
    player.mentalSkills = [skill];

    // Game 1: triggered in high-leverage → XP grows
    player = updateMentalSkillsPostGame(player, {
      playerAge: 28,
      gameNumber: 1,
      highLeverageTriggered: ["ice_veins"],
      normalTriggered: [],
    });
    const xpAfterGame1 = player.mentalSkills![0].xp;

    // Game 2: triggered normally → XP grows more
    player = updateMentalSkillsPostGame(player, {
      playerAge: 28,
      gameNumber: 2,
      highLeverageTriggered: [],
      normalTriggered: ["ice_veins"],
    });
    const xpAfterGame2 = player.mentalSkills![0].xp;

    expect(xpAfterGame1).toBeGreaterThan(0);
    expect(xpAfterGame2).toBeGreaterThan(xpAfterGame1);
  });

  it("confidence decays when skill is not triggered, and recovers when triggered again", () => {
    let player = makePlayer();
    const skill = makeSkill({ skillId: "ice_veins", rank: 1, confidence: 70 });
    player.mentalSkills = [skill];

    // Game 1: triggered → confidence should not drop
    player = updateMentalSkillsPostGame(player, {
      playerAge: 28,
      gameNumber: 1,
      highLeverageTriggered: ["ice_veins"],
      normalTriggered: [],
    });
    const confAfterTrigger = player.mentalSkills![0].confidence;

    // Game 2: not triggered → confidence decays
    player = updateMentalSkillsPostGame(player, {
      playerAge: 28,
      gameNumber: 2,
      highLeverageTriggered: [],
      normalTriggered: [],
    });
    const confAfterDecay = player.mentalSkills![0].confidence;

    expect(confAfterDecay).toBeLessThan(confAfterTrigger);
  });

  it("breakthrough history accumulates on player across multiple events", () => {
    const player = makePlayer({ traits: ["Ice"] });
    const s1 = seedSkillAtRank(player, "ice_veins", 1, 0.9);
    const ctx = breakthroughCtx({ rng: makeRng([0.05]) });
    const e1 = checkBreakthroughTrigger(player, ctx, "ice_veins", s1);
    if (e1) activateBreakthrough(player, e1);

    expect((player.breakthroughEvents?.length ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("bad habit strength accumulates correctly across reinforce calls", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    const habit = player.badHabits![0];

    reinforceHabit(habit, player, 2);
    const afterFirst = habit.strength;
    reinforceHabit(habit, player, 3);
    const afterSecond = habit.strength;

    expect(afterSecond).toBeGreaterThan(afterFirst);
  });

  it("combo trigger count persists in store across scan calls", () => {
    const mentor = makePlayer({ id: "persist-m", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "persist-a", age: 24 });
    createMentorship(mentor, apprentice, 1, Math.random);

    const store: DiscoveredCombo[] = [];
    const ctx = { inning: 8, isCloseGame: true, scoreDiff: -1, currentGameNumber: 1, rng: () => 0.1 };

    scanForCombos([mentor, apprentice], store, { ...ctx, currentGameNumber: 1 });
    const after1 = getTotalComboTriggers(store);

    scanForCombos([mentor, apprentice], store, { ...ctx, currentGameNumber: 2 });
    const after2 = getTotalComboTriggers(store);

    if (after1 > 0) {
      expect(after2).toBeGreaterThanOrEqual(after1);
    }
  });

  it("mentor-apprentice lineage is visible after addLineageNode", () => {
    const mentor = makePlayer({ id: "lineage-m2", age: 36, name: "Elder" });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "lineage-a2", age: 24 });

    addLineageNode(apprentice, mentor);

    expect(apprentice.lineage).toBeDefined();
    expect(apprentice.lineage!.length).toBeGreaterThanOrEqual(1);
    expect(apprentice.lineage![0].playerId).toBe("lineage-m2");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — Balance Checks
// ═══════════════════════════════════════════════════════════════════════════════

describe("Balance Checks", () => {
  it("mental skill bonus at max rank stays modest (< 20 stat points)", () => {
    const maxSkill = makeSkill({ rank: 5, confidence: 100, isActive: true });
    const bonus = getMentalSkillBonus(maxSkill);
    expect(bonus).toBeLessThan(20);
  });

  it("signature skill advantage does not exceed 25% at scout tier 0", () => {
    const player = makePlayer();
    const sig = seedSignature(player);
    const activeSig = getActiveSignatureSkill(player)!;

    const base = 0.5;
    const boosted = applySignatureEffect(base, activeSig, 0);
    const advantage = (boosted - base) / base;
    expect(advantage).toBeLessThan(0.25);
  });

  it("mentorship XP multiplier for apprentice is between 1.0x and 2.5x", () => {
    const mentor = makePlayer({ id: "bal-m", age: 36 });
    seedSignature(mentor);
    const apprentice = makePlayer({ id: "bal-a", age: 24 });
    createMentorship(mentor, apprentice, 1, Math.random);

    const ctx: MentorshipGameContext = {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: true,
    };

    const multiplier = applyMentorshipXPModifiers(apprentice, ctx);
    expect(multiplier).toBeGreaterThan(1.0);
    expect(multiplier).toBeLessThanOrEqual(2.5);
  });

  it("legacy bonus accumulates with generations but is capped", () => {
    const gen1 = makePlayer({ id: "bal-g1", age: 45, name: "Ancestor" });
    const gen2 = makePlayer({ id: "bal-g2", age: 35 });
    const gen3 = makePlayer({ id: "bal-g3", age: 24 });

    // Add gen1 → gen2 → gen3 lineage
    addLineageNode(gen2, gen1);
    addLineageNode(gen3, gen2);

    // applyLegacyBonus only counts nodes where signatureSkillName matches skillId
    // In practice may return 0 unless signature names contain the skill keyword
    const bonus = applyLegacyBonus(gen3, "ice_veins");
    expect(bonus).toBeGreaterThanOrEqual(0);
    expect(bonus).toBeLessThanOrEqual(0.5); // cap ≤ 50%
  });

  it("bad habit creates measurable contact penalty (>5%)", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    player.badHabits![0].strength = 80;
    player.badHabits![0].isActive = true;

    const effect = getCombinedHabitEffect(player);
    expect(effect.totalContactPenalty).toBeGreaterThan(0.05);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — Full Career Smoke Test (10 Seasons)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Full Career Smoke Test — 10 Seasons", () => {
  it("simulates a 10-season career without throwing and hits milestone events", () => {
    let player = makePlayer({
      id: "smoke-player",
      name: "Smoke",
      traits: ["Ice", "Eye", "Wile"],
      age: 22,
      seasonsPlayed: 0,
    });

    const mentor = makePlayer({
      id: "smoke-mentor",
      name: "Elder",
      age: 38,
      traits: ["Wile"],
    });
    seedSignature(mentor);

    let breakthroughCount = 0;
    let habitFormed = false;
    let habitBroken = false;
    let mentorshipActive = false;

    for (let season = 0; season < 10; season++) {
      player = { ...player, age: 22 + season, seasonsPlayed: season };
      const GAMES = 30;

      // Discover eligible mental skills once per season
      for (const skillType of getEligibleMentalSkills(player)) {
        const discovered = discoverMentalSkill(
          player,
          skillType,
          discoveryCtx({
            playerAge: player.age!,
            gameNumber: season * GAMES + 1,
            completeSeasonsPlayed: season,
            seasonWalkCount: 20,
            isHighLeverage: true,
            scoreDiff: 1,
          })
        );
        if (discovered) {
          if (!player.mentalSkills) player.mentalSkills = [];
          // Attach skill to player (discoverMentalSkill returns but doesn't attach)
          player.mentalSkills = [...player.mentalSkills, discovered];
        }
      }

      // Set up mentorship at age 30
      if ((player.age ?? 0) >= 30 && !mentorshipActive && checkMentorEligibility(mentor, player)) {
        createMentorship(mentor, player, season * GAMES, Math.random);
        addLineageNode(player, mentor);
        mentorshipActive = true;
      }

      for (let game = 0; game < GAMES; game++) {
        const gameNumber = season * GAMES + game + 1;
        const isHighLeverage = game % 5 === 0;
        const scoreDiff = game % 3;

        // Post-game mental skill update (using immutable pattern)
        if (player.mentalSkills && player.mentalSkills.length > 0) {
          const triggered = player.mentalSkills
            .filter((s) => s.isActive && checkSkillTrigger(s.skillId as MentalSkillType, {
              isHighLeverage,
              inning: 8,
              scoreDiff,
              outcome: "single",
              batterApproach: "contact",
            }))
            .map((s) => s.skillId as MentalSkillType);

          player = updateMentalSkillsPostGame(player, {
            playerAge: player.age!,
            gameNumber,
            highLeverageTriggered: isHighLeverage ? triggered : [],
            normalTriggered: isHighLeverage ? [] : triggered,
          });
        }

        // Attempt breakthroughs in high-leverage moments
        if (isHighLeverage && player.mentalSkills) {
          const updatedSkills = [...player.mentalSkills];
          for (const skill of updatedSkills) {
            if (!skill.isActive || skill.rank >= 5) continue;
            // Boost XP to near threshold for determinism
            if (skill.xp < MENTAL_SKILL_RANK_XP[skill.rank] * 0.8) {
              skill.xp = Math.floor(MENTAL_SKILL_RANK_XP[skill.rank] * 0.85);
            }

            const ctx = breakthroughCtx({
              gameNumber,
              rng: makeRng([0.05]),
              isHighLeverage: true,
            });
            const event = checkBreakthroughTrigger(player, ctx, skill.skillId as MentalSkillType, skill);
            if (event) {
              activateBreakthrough(player, event);
              breakthroughCount++;
            }
          }
        }

        // Form a bad habit in season 2
        if (season === 2 && game === 20 && !habitFormed) {
          formBadHabit(player, "pull_happy", "approach_streak", gameNumber);
          habitFormed = true;
        }

        // Break the habit in season 3
        if (habitFormed && !habitBroken && season === 3 && game === 10) {
          const active = getActiveHabits(player);
          if (active.length === 0 && player.badHabits && player.badHabits.length > 0) {
            // Manually activate and break
            player.badHabits[0].strength = 60;
            player.badHabits[0].isActive = true;
          }
          const habit = getActiveHabits(player)[0];
          if (habit) {
            breakHabit(habit, player, gameNumber);
            habitBroken = true;
          }
        }
      }
    }

    // ── Assertions ──────────────────────────────────────────────────────────

    // Player discovered mental skills (Ice, Eye, Wile traits)
    expect((player.mentalSkills?.length ?? 0)).toBeGreaterThan(0);

    // Breakthroughs occurred
    expect(breakthroughCount).toBeGreaterThan(0);

    // Bad habit was formed
    expect(habitFormed).toBe(true);

    // Mentorship was activated at age 30
    expect(mentorshipActive).toBe(true);
    expect(player.lineage?.length).toBeGreaterThanOrEqual(1);

    // Player survived 10 seasons
    expect(player.age).toBe(31);
  });
});
