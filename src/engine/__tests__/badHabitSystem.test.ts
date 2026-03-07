import { describe, it, expect, beforeEach } from "vitest";
import type { Player } from "@/types/game";
import type { BadHabit } from "@/types/badHabits";
import { HABIT_THRESHOLDS } from "@/types/badHabits";
import {
  trackSkillUsage,
  trackApproachUsage,
  recordVariedApproach,
  formBadHabit,
  reinforceHabit,
  weakenHabit,
  breakHabit,
  hasActiveBadHabit,
  getActiveHabits,
  getPlayerHabits,
  getCombinedHabitEffect,
  generateHabitCostNarrative,
  resetUsageLog,
  applyReinventionReset,
  getOrCreateUsageLog,
} from "@/engine/badHabitSystem";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-test",
    name: "Rodriguez",
    surname: "Rodriguez",
    role: "Batter",
    stats: { avg: 0.280, power: 70, speed: 60, contact: 75 } as never,
    salary: 5000,
    level: 5,
    xp: 100,
    totalXpEarned: 500,
    equipment: {} as never,
    spirit: { current: 50, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...overrides,
  };
}

function makeHabit(overrides: Partial<BadHabit> = {}): BadHabit {
  return {
    habitId: "habit-test",
    habitType: "pull_happy",
    formationType: "approach_streak",
    strength: 30,
    isActive: false,
    consecutiveUses: 10,
    consecutiveNonUses: 0,
    formedAtGame: 1,
    opponentKnowledge: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Habit Formation
// ---------------------------------------------------------------------------

describe("Bad Habit Formation", () => {
  it("creates a habit with correct initial state", () => {
    const player = makePlayer();
    const habit = formBadHabit(player, "pull_happy", "approach_streak", 5, undefined, "power");

    expect(habit.habitId).toContain("pull_happy");
    expect(habit.habitType).toBe("pull_happy");
    expect(habit.strength).toBe(0);
    expect(habit.isActive).toBe(false);
    expect(habit.formedAtGame).toBe(5);
    expect(habit.brokenAt).toBeUndefined();
    expect(habit.consecutiveUses).toBe(HABIT_THRESHOLDS.FORMATION_STREAK_LENGTH);
    expect(habit.consecutiveNonUses).toBe(0);
    expect(habit.opponentKnowledge).toBe(0);
  });

  it("attaches habit to player.badHabits", () => {
    const player = makePlayer();
    expect(player.badHabits).toBeUndefined();

    formBadHabit(player, "telegraphed", "skill_streak", 3, "signature_pitch");

    expect(player.badHabits).toBeDefined();
    expect(player.badHabits!.length).toBe(1);
    expect(player.badHabits![0].habitType).toBe("telegraphed");
    expect(player.badHabits![0].sourceSkillId).toBe("signature_pitch");
  });

  it("multiple habits can coexist on the same player", () => {
    const player = makePlayer();
    formBadHabit(player, "pull_happy", "approach_streak", 1);
    formBadHabit(player, "overthinking", "skill_streak", 3, "ice_veins");

    expect(player.badHabits!.length).toBe(2);
    const types = player.badHabits!.map((h) => h.habitType);
    expect(types).toContain("pull_happy");
    expect(types).toContain("overthinking");
  });

  it("habit forms after 10+ consecutive skill uses via trackSkillUsage", () => {
    const player = makePlayer();

    for (let i = 0; i < 9; i++) {
      const events = trackSkillUsage(player, "ice_veins", 1);
      expect(events.some((e) => e.type === "formed")).toBe(false);
    }

    // 10th consecutive use — should form
    const events = trackSkillUsage(player, "ice_veins", 1);
    expect(events.some((e) => e.type === "formed")).toBe(true);
  });

  it("habit does NOT form with fewer than 10 consecutive uses", () => {
    const player = makePlayer();

    for (let i = 0; i < 9; i++) {
      trackSkillUsage(player, "ice_veins", 1);
    }

    expect(getPlayerHabits(player).length).toBe(0);
  });

  it("streak resets when a different skill is used", () => {
    const player = makePlayer();

    for (let i = 0; i < 7; i++) {
      trackSkillUsage(player, "ice_veins", 1);
    }
    // Switch skill — resets ice_veins streak
    trackSkillUsage(player, "clutch_composure", 1);

    // Continue ice_veins — should NOT form (streak reset)
    for (let i = 0; i < 3; i++) {
      trackSkillUsage(player, "ice_veins", 1);
    }

    expect(getPlayerHabits(player).filter((h) => !h.brokenAt).length).toBe(0);
  });

  it("approach habit forms after 10 consecutive power approaches", () => {
    const player = makePlayer();

    for (let i = 0; i < 9; i++) {
      const events = trackApproachUsage(player, "power", "pull_happy", 1);
      expect(events.some((e) => e.type === "formed")).toBe(false);
    }

    const events = trackApproachUsage(player, "power", "pull_happy", 1);
    expect(events.some((e) => e.type === "formed")).toBe(true);
  });

  it("non-pattern approach does not form a habit", () => {
    const player = makePlayer();

    for (let i = 0; i < 15; i++) {
      trackApproachUsage(player, "contact", "pull_happy", 1);
    }

    expect(getPlayerHabits(player).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Habit Strength
// ---------------------------------------------------------------------------

describe("Habit Strength Scaling", () => {
  it("reinforcing increases strength by STRENGTH_INCREASE_PER_USE", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 30 });
    player.badHabits = [habit];

    reinforceHabit(habit, player, 2);

    expect(habit.strength).toBe(30 + HABIT_THRESHOLDS.STRENGTH_INCREASE_PER_USE);
  });

  it("strength caps at MAX_STRENGTH (100)", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 98 });
    player.badHabits = [habit];

    reinforceHabit(habit, player, 2);
    expect(habit.strength).toBe(100);

    // Another reinforce should stay at 100
    reinforceHabit(habit, player, 2);
    expect(habit.strength).toBe(100);
  });

  it("weakening decreases strength by STRENGTH_DECREASE_PER_VARIED_AB", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 60, isActive: true });
    player.badHabits = [habit];

    weakenHabit(habit, player, 2);

    expect(habit.strength).toBe(60 - HABIT_THRESHOLDS.STRENGTH_DECREASE_PER_VARIED_AB);
  });

  it("strength floors at MIN_STRENGTH (0)", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 5 });
    player.badHabits = [habit];

    weakenHabit(habit, player, 2);
    expect(habit.strength).toBeGreaterThanOrEqual(0);
  });

  it("isActive becomes true when crossing 50 threshold", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 48, isActive: false });
    player.badHabits = [habit];

    // 48 + 5 = 53 → crosses 50
    const event = reinforceHabit(habit, player, 2);

    expect(habit.isActive).toBe(true);
    expect(event.type).toBe("activated");
  });

  it("isActive becomes false when strength drops below 50", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 53, isActive: true });
    player.badHabits = [habit];

    // 53 - 10 = 43 → drops below 50
    weakenHabit(habit, player, 2);

    expect(habit.isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Habit Breaking
// ---------------------------------------------------------------------------

describe("Habit Breaking", () => {
  it("habit breaks after 3 non-pattern ABs", () => {
    const player = makePlayer();
    const habit = makeHabit({
      strength: 60,
      isActive: true,
      consecutiveNonUses: 0,
    });
    player.badHabits = [habit];

    weakenHabit(habit, player, 2); // nonUses = 1
    weakenHabit(habit, player, 2); // nonUses = 2
    const event = weakenHabit(habit, player, 2); // nonUses = 3 → break

    expect(event.type).toBe("broken");
    expect(habit.brokenAt).toBe(2);
    expect(habit.strength).toBe(0);
    expect(habit.isActive).toBe(false);
    expect(event.narrative).toBeDefined();
  });

  it("breaking resets opponent knowledge to 0", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 80, isActive: true, opponentKnowledge: 2 });
    player.badHabits = [habit];

    breakHabit(habit, player, 5);

    expect(habit.opponentKnowledge).toBe(0);
  });

  it("two non-pattern ABs are not enough to break", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 60, isActive: true });
    player.badHabits = [habit];

    weakenHabit(habit, player, 2);
    weakenHabit(habit, player, 2);

    expect(habit.brokenAt).toBeUndefined();
  });

  it("recordVariedApproach weakens all active habits", () => {
    const player = makePlayer();
    const h1 = makeHabit({ habitId: "h1", habitType: "pull_happy", strength: 60, isActive: true });
    const h2 = makeHabit({ habitId: "h2", habitType: "overthinking", strength: 70, isActive: true });
    player.badHabits = [h1, h2];

    recordVariedApproach(player, 3);

    expect(h1.strength).toBeLessThan(60);
    expect(h2.strength).toBeLessThan(70);
  });

  it("recordVariedApproach does not affect inactive habits", () => {
    const player = makePlayer();
    const inactive = makeHabit({ strength: 30, isActive: false });
    player.badHabits = [inactive];

    recordVariedApproach(player, 3);

    // Inactive habits are not touched by recordVariedApproach
    expect(inactive.strength).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Active habit queries
// ---------------------------------------------------------------------------

describe("Active Habit Queries", () => {
  it("hasActiveBadHabit returns false with no habits", () => {
    const player = makePlayer();
    expect(hasActiveBadHabit(player)).toBe(false);
  });

  it("hasActiveBadHabit returns false with only inactive habits", () => {
    const player = makePlayer();
    player.badHabits = [makeHabit({ strength: 30, isActive: false })];

    expect(hasActiveBadHabit(player)).toBe(false);
  });

  it("hasActiveBadHabit returns true with at least one active habit", () => {
    const player = makePlayer();
    player.badHabits = [makeHabit({ strength: 60, isActive: true })];

    expect(hasActiveBadHabit(player)).toBe(true);
  });

  it("hasActiveBadHabit returns false for broken habits even if was active", () => {
    const player = makePlayer();
    player.badHabits = [makeHabit({ strength: 0, isActive: false, brokenAt: 10 })];

    expect(hasActiveBadHabit(player)).toBe(false);
  });

  it("getActiveHabits filters correctly", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitId: "h1", strength: 60, isActive: true }),
      makeHabit({ habitId: "h2", strength: 30, isActive: false }),
      makeHabit({ habitId: "h3", strength: 0, isActive: false, brokenAt: 5 }),
    ];

    const active = getActiveHabits(player);
    expect(active.length).toBe(1);
    expect(active[0].habitId).toBe("h1");
  });

  it("getPlayerHabits returns all habits including broken", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitId: "h1", strength: 60, isActive: true }),
      makeHabit({ habitId: "h2", strength: 0, isActive: false, brokenAt: 3 }),
    ];

    const all = getPlayerHabits(player);
    expect(all.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Combined habit effects
// ---------------------------------------------------------------------------

describe("Combined Habit Effects", () => {
  it("returns neutral effect for player with no habits", () => {
    const player = makePlayer();
    const effect = getCombinedHabitEffect(player);

    expect(effect.totalContactPenalty).toBe(0);
    expect(effect.totalOpponentContactBonus).toBe(0);
    expect(effect.maxFatigueRate).toBe(1);
    expect(effect.hasShift).toBe(false);
  });

  it("sums contact penalties across multiple active habits", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitType: "pull_happy", strength: 100, isActive: true }),
      makeHabit({ habitId: "h2", habitType: "chase_artist", strength: 100, isActive: true }),
    ];

    const effect = getCombinedHabitEffect(player);
    // pull_happy: 15 * 1.0 = 15, chase_artist: 8 * 1.0 = 8 → total 23
    expect(effect.totalContactPenalty).toBeCloseTo(23, 1);
  });

  it("maxFatigueRate takes the highest fatigueRate across habits", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitType: "chase_artist", strength: 100, isActive: true }),
    ];

    const effect = getCombinedHabitEffect(player);
    // fatigueRate = 1 + (0.2 * 1.0) = 1.2
    expect(effect.maxFatigueRate).toBeCloseTo(1.2, 2);
  });

  it("hasShift true when pull_happy is active", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitType: "pull_happy", strength: 80, isActive: true }),
    ];

    const effect = getCombinedHabitEffect(player);
    expect(effect.hasShift).toBe(true);
    expect(effect.maxShiftProbability).toBeGreaterThan(0);
  });

  it("inactive habits do not contribute to combined effect", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitType: "pull_happy", strength: 40, isActive: false }),
    ];

    const effect = getCombinedHabitEffect(player);
    expect(effect.totalContactPenalty).toBe(0);
    expect(effect.hasShift).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Breakthrough integration
// ---------------------------------------------------------------------------

describe("Breakthrough Integration", () => {
  it("hasActiveBadHabit correctly signals to breakthrough system", () => {
    const playerClean = makePlayer();
    const playerWithHabit = makePlayer({ id: "p2" });
    playerWithHabit.badHabits = [makeHabit({ strength: 60, isActive: true })];

    // Clean player → no penalty
    expect(hasActiveBadHabit(playerClean)).toBe(false);
    // Player with habit → -15% breakthrough penalty applies
    expect(hasActiveBadHabit(playerWithHabit)).toBe(true);
  });

  it("broken habit does not block breakthrough", () => {
    const player = makePlayer();
    player.badHabits = [makeHabit({ strength: 0, isActive: false, brokenAt: 10 })];

    expect(hasActiveBadHabit(player)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Narrative generation
// ---------------------------------------------------------------------------

describe("Narrative Generation", () => {
  it("generateHabitCostNarrative returns a non-empty string", () => {
    const player = makePlayer();
    const narrative = generateHabitCostNarrative(player);

    expect(typeof narrative).toBe("string");
    expect(narrative.length).toBeGreaterThan(0);
  });

  it("break narrative is generated when habit is broken", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 60, isActive: true });
    player.badHabits = [habit];

    const event = breakHabit(habit, player, 7);

    expect(event.narrative).toBeDefined();
    expect(event.narrative!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Opponent knowledge
// ---------------------------------------------------------------------------

describe("Opponent Knowledge Tracking", () => {
  it("opponentKnowledge starts at 0", () => {
    const player = makePlayer();
    const habit = formBadHabit(player, "pull_happy", "approach_streak", 1);

    expect(habit.opponentKnowledge).toBe(0);
  });

  it("opponentKnowledge resets to 0 when habit is broken", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 80, isActive: true, opponentKnowledge: 2 });
    player.badHabits = [habit];

    breakHabit(habit, player, 10);

    expect(habit.opponentKnowledge).toBe(0);
  });

  it("opponentKnowledge caps at 3", () => {
    const player = makePlayer();
    const habit = makeHabit({ strength: 80, isActive: true, opponentKnowledge: 3 });
    player.badHabits = [habit];

    // Already at 3 — should not exceed
    reinforceHabit(habit, player, 5);

    expect(habit.opponentKnowledge).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Usage log management
// ---------------------------------------------------------------------------

describe("Usage Log Management", () => {
  it("getOrCreateUsageLog initializes log if missing", () => {
    const player = makePlayer();
    expect(player.habitUsageLog).toBeUndefined();

    const log = getOrCreateUsageLog(player);

    expect(log).toBeDefined();
    expect(log.skillStreaks).toEqual({});
    expect(log.approachStreaks).toEqual({});
    expect(log.recentApproaches).toEqual([]);
    expect(log.recentSkills).toEqual([]);
  });

  it("resetUsageLog clears streaks but keeps habits", () => {
    const player = makePlayer();
    player.badHabits = [makeHabit({ strength: 60, isActive: true })];

    const log = getOrCreateUsageLog(player);
    log.skillStreaks["ice_veins"] = 8;
    log.recentSkills = ["ice_veins", "ice_veins"];

    resetUsageLog(player);

    expect(player.habitUsageLog!.skillStreaks).toEqual({});
    expect(player.habitUsageLog!.recentSkills).toEqual([]);
    // Habits still exist
    expect(player.badHabits!.length).toBe(1);
  });

  it("recentSkills rolls off at 10 entries", () => {
    const player = makePlayer();

    for (let i = 0; i < 15; i++) {
      trackSkillUsage(player, "ice_veins", 1);
    }

    const log = getOrCreateUsageLog(player);
    expect(log.recentSkills.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Reinvention arc
// ---------------------------------------------------------------------------

describe("Reinvention Arc Reset", () => {
  it("applyReinventionReset breaks all active habits", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitId: "h1", habitType: "pull_happy", strength: 70, isActive: true }),
      makeHabit({ habitId: "h2", habitType: "chase_artist", strength: 55, isActive: true }),
    ];

    const events = applyReinventionReset(player, 15);

    expect(events.length).toBe(2);
    expect(events.every((e) => e.type === "broken")).toBe(true);
    expect(hasActiveBadHabit(player)).toBe(false);
  });

  it("applyReinventionReset resets usage log", () => {
    const player = makePlayer();
    const log = getOrCreateUsageLog(player);
    log.skillStreaks["ice_veins"] = 9;

    applyReinventionReset(player, 15);

    expect(player.habitUsageLog!.skillStreaks).toEqual({});
  });

  it("reinvention does not affect already-broken habits", () => {
    const player = makePlayer();
    player.badHabits = [
      makeHabit({ habitId: "h1", strength: 0, isActive: false, brokenAt: 10 }),
    ];

    const events = applyReinventionReset(player, 20);

    // No active habits to break
    expect(events.length).toBe(0);
  });
});
