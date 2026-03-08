/**
 * Tests for reinventionSystem.ts — Issue #34
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Player } from "@/types/game";
import type { SignatureSkill } from "@/types/breakthroughs";
import type { MentalSkill } from "@/types/mentalSkills";
import type { ReinventionEvent } from "@/types/reinvention";
import {
  checkReinventionEligibility,
  triggerReinvention,
  getReinventionModifiers,
  isInReinventionSeason,
  applyPhysicalReinventionModifier,
  applyMentalXpReinventionModifier,
  expireReinventionModifiers,
  resolveReinventionOutcome,
  narrativeReinventionTrigger,
  narrativeReinventionOutcome,
} from "@/engine/reinventionSystem";
import {
  REINVENTION_SUCCESS_AVG_THRESHOLD,
  REINVENTION_PHYSICAL_MULTIPLIER,
  REINVENTION_MENTAL_XP_MULTIPLIER,
  REINVENTION_MIN_AGE,
  REINVENTION_MIN_SEASONS,
} from "@/types/reinvention";
import { generateSignatureSkill } from "@/engine/signatureSkillSystem";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-vet",
    name: "Rivera",
    surname: "Rivera",
    role: "Batter",
    stats: { power: 70, contact: 75, glove: 60, speed: 65 },
    salary: 5000,
    level: 8,
    xp: 800,
    totalXpEarned: 5000,
    equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    spirit: { current: 80, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    age: 31,
    seasonsPlayed: 8,
    ...overrides,
  };
}

function makeSignature(playerId = "p-vet", signatureId = "sig-vet-001"): SignatureSkill {
  const bt = {
    breakthroughId: "bt-vet",
    playerId,
    skillId: "ice_veins" as const,
    skillRank: 5,
    archetype: "streak_moment" as const,
    triggeredAt: { gameNumber: 5, inning: 9, scoreDiff: 0, context: "tied, 9th+" },
    narrative: "Clicked.",
    memoryLabel: "Rivera's Ice Veins (G5)",
    signatureSkillId: signatureId,
    createdAt: new Date(),
  };
  const player = makePlayer({ id: playerId });
  return generateSignatureSkill(player, bt);
}

function playerWithSignature(overrides: Partial<Player> = {}): Player {
  const player = makePlayer(overrides);
  const sig = makeSignature(player.id, "sig-active");
  player.signatureSkills = new Map([["sig-active", sig]]);
  return player;
}

function makeSkill(overrides: Partial<MentalSkill> = {}): MentalSkill {
  return {
    skillId: "veteran_poise",
    rank: 2,
    xp: 50,
    xpToNextRank: 100,
    confidence: 70,
    lastTriggeredGame: 0,
    isActive: true,
    decayRate: 5,
    wasLapsed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Reinvention constants", () => {
  it("success threshold is 0.220", () => {
    expect(REINVENTION_SUCCESS_AVG_THRESHOLD).toBe(0.220);
  });

  it("physical multiplier is 0.90 (-10%)", () => {
    expect(REINVENTION_PHYSICAL_MULTIPLIER).toBe(0.90);
  });

  it("mental XP multiplier is 1.20 (+20%)", () => {
    expect(REINVENTION_MENTAL_XP_MULTIPLIER).toBe(1.20);
  });

  it("minimum age is 29", () => {
    expect(REINVENTION_MIN_AGE).toBe(29);
  });

  it("minimum seasons is 7", () => {
    expect(REINVENTION_MIN_SEASONS).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// checkReinventionEligibility
// ---------------------------------------------------------------------------

describe("checkReinventionEligibility", () => {
  it("returns true when age 29+ with signature and no prior reinvention", () => {
    const player = playerWithSignature({ age: 29, seasonsPlayed: 3 });
    expect(checkReinventionEligibility(player, 5)).toBe(true);
  });

  it("returns true when 7+ seasons with signature even if age < 29", () => {
    const player = playerWithSignature({ age: 26, seasonsPlayed: 7 });
    expect(checkReinventionEligibility(player, 7)).toBe(true);
  });

  it("returns false when age < 29 and seasons < 7", () => {
    const player = playerWithSignature({ age: 26, seasonsPlayed: 5 });
    expect(checkReinventionEligibility(player, 5)).toBe(false);
  });

  it("returns false when no active signature skill", () => {
    const player = makePlayer({ age: 32, seasonsPlayed: 9 });
    // No signatureSkills at all
    expect(checkReinventionEligibility(player, 9)).toBe(false);
  });

  it("returns false when player already reinvented", () => {
    const player = playerWithSignature({ age: 33, seasonsPlayed: 10 });
    const existingEvent: ReinventionEvent = {
      reinventionId: "old-reinvention",
      playerId: player.id,
      triggeredAt: { season: 8, gameNumber: 0 },
      archivedSignatureId: "sig-old",
      resetHabits: [],
      resetOpponents: [],
      outcome: "success",
      resolvedAt: { season: 8, finalAvg: 0.250 },
    };
    player.reinventionEvent = existingEvent;
    expect(checkReinventionEligibility(player, 10)).toBe(false);
  });

  it("returns false when signature is archived (not active)", () => {
    const player = makePlayer({ age: 32, seasonsPlayed: 9 });
    const sig = makeSignature(player.id, "sig-archived");
    sig.isActive = false;
    sig.isArchived = true;
    player.signatureSkills = new Map([["sig-archived", sig]]);
    expect(checkReinventionEligibility(player, 9)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// triggerReinvention
// ---------------------------------------------------------------------------

describe("triggerReinvention", () => {
  it("throws when player is not eligible", () => {
    const player = makePlayer({ age: 24, seasonsPlayed: 3 }); // too young, no sig
    expect(() => triggerReinvention(player, 3)).toThrow();
  });

  it("returns a ReinventionEvent", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    const event = triggerReinvention(player, 8);
    expect(event).toBeTruthy();
    expect(event.playerId).toBe(player.id);
  });

  it("archives the active signature skill", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    const sig = player.signatureSkills?.get("sig-active");
    expect(sig?.isArchived).toBe(true);
    expect(sig?.isActive).toBe(false);
  });

  it("stores the archived signature ID in the event", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    const event = triggerReinvention(player, 8);
    expect(event.archivedSignatureId).toBe("sig-active");
  });

  it("stores the event on player.reinventionEvent", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(player.reinventionEvent).toBeTruthy();
    expect(player.reinventionEvent?.outcome).toBe("in_progress");
  });

  it("sets reinvention modifiers on the player", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(player.reinventionModifiers).toBeTruthy();
    expect(player.reinventionModifiers?.physicalMultiplier).toBe(0.90);
    expect(player.reinventionModifiers?.mentalXpMultiplier).toBe(1.20);
  });

  it("stores the triggered season in event.triggeredAt", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    const event = triggerReinvention(player, 8, 15);
    expect(event.triggeredAt.season).toBe(8);
    expect(event.triggeredAt.gameNumber).toBe(15);
  });

  it("outcome starts as 'in_progress'", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    const event = triggerReinvention(player, 8);
    expect(event.outcome).toBe("in_progress");
  });

  it("resets bad habits on trigger", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    // Give player an active bad habit
    player.badHabits = [
      {
        habitId: "habit-test-001",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 80,
        isActive: true,
        consecutiveUses: 5,
        consecutiveNonUses: 0,
        formedAtGame: 1,
        opponentKnowledge: 1,
      },
    ];
    const event = triggerReinvention(player, 8);
    // resetHabits should contain the habit ID
    expect(event.resetHabits).toContain("habit-test-001");
    // The habit itself should no longer be active
    const habit = player.badHabits?.find((h) => h.habitId === "habit-test-001");
    expect(habit?.isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getReinventionModifiers / isInReinventionSeason
// ---------------------------------------------------------------------------

describe("getReinventionModifiers", () => {
  it("returns null when no modifiers set", () => {
    const player = makePlayer();
    expect(getReinventionModifiers(player, 5)).toBeNull();
  });

  it("returns modifiers during the reinvention season", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    const mods = getReinventionModifiers(player, 8);
    expect(mods).toBeTruthy();
    expect(mods?.physicalMultiplier).toBe(0.90);
    expect(mods?.mentalXpMultiplier).toBe(1.20);
  });

  it("returns null after the reinvention season expires", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(getReinventionModifiers(player, 9)).toBeNull(); // Season 9 is after 8
  });
});

describe("isInReinventionSeason", () => {
  it("returns false when not reinventing", () => {
    expect(isInReinventionSeason(makePlayer(), 5)).toBe(false);
  });

  it("returns true during reinvention season", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(isInReinventionSeason(player, 8)).toBe(true);
  });

  it("returns false in following season", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(isInReinventionSeason(player, 9)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyPhysicalReinventionModifier / applyMentalXpReinventionModifier
// ---------------------------------------------------------------------------

describe("applyPhysicalReinventionModifier", () => {
  it("returns base value when not in reinvention", () => {
    const player = makePlayer();
    expect(applyPhysicalReinventionModifier(100, player, 5)).toBe(100);
  });

  it("reduces physical by 10% during reinvention season", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(applyPhysicalReinventionModifier(100, player, 8)).toBeCloseTo(90);
  });

  it("returns full value in season after reinvention", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(applyPhysicalReinventionModifier(100, player, 9)).toBe(100);
  });
});

describe("applyMentalXpReinventionModifier", () => {
  it("returns base XP when not in reinvention", () => {
    const player = makePlayer();
    expect(applyMentalXpReinventionModifier(10, player, 5)).toBe(10);
  });

  it("adds 20% to mental XP during reinvention season", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(applyMentalXpReinventionModifier(10, player, 8)).toBe(12);
  });

  it("returns base XP in season after reinvention", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(applyMentalXpReinventionModifier(10, player, 9)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// expireReinventionModifiers
// ---------------------------------------------------------------------------

describe("expireReinventionModifiers", () => {
  it("returns false when no modifiers exist", () => {
    const player = makePlayer();
    expect(expireReinventionModifiers(player, 9)).toBe(false);
  });

  it("returns false during reinvention season (not yet expired)", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(expireReinventionModifiers(player, 8)).toBe(false);
  });

  it("removes modifiers when season has passed", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    const result = expireReinventionModifiers(player, 9);
    expect(result).toBe(true);
    expect(player.reinventionModifiers).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveReinventionOutcome
// ---------------------------------------------------------------------------

describe("resolveReinventionOutcome", () => {
  it("returns null when player has no reinvention event", () => {
    const player = makePlayer();
    expect(resolveReinventionOutcome(player, { avg: 0.280 }, 8)).toBeNull();
  });

  it("returns null when outcome is already set (not in_progress)", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    player.reinventionEvent!.outcome = "success";
    expect(resolveReinventionOutcome(player, { avg: 0.280 }, 8)).toBeNull();
  });

  it("resolves as 'success' when avg > 0.220", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    const result = resolveReinventionOutcome(player, { avg: 0.250 }, 8);
    expect(result).toBe("success");
    expect(player.reinventionEvent?.outcome).toBe("success");
  });

  it("resolves as 'failure' when avg <= 0.220", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    const result = resolveReinventionOutcome(player, { avg: 0.200 }, 8);
    expect(result).toBe("failure");
    expect(player.reinventionEvent?.outcome).toBe("failure");
  });

  it("resolves as 'failure' when avg exactly 0.220 (not > threshold)", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    const result = resolveReinventionOutcome(player, { avg: 0.220 }, 8);
    expect(result).toBe("failure");
  });

  it("stores resolvedAt data on the event", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    resolveReinventionOutcome(player, { avg: 0.240 }, 8);
    expect(player.reinventionEvent?.resolvedAt?.season).toBe(8);
    expect(player.reinventionEvent?.resolvedAt?.finalAvg).toBeCloseTo(0.240);
  });

  it("advances Veteran's Poise rank on failure", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    player.mentalSkills = [makeSkill({ skillId: "veteran_poise", rank: 2 })];
    triggerReinvention(player, 8);
    resolveReinventionOutcome(player, { avg: 0.190 }, 8);

    const poise = player.mentalSkills?.find((s) => s.skillId === "veteran_poise");
    expect(poise?.rank).toBe(3); // advanced from 2 to 3
    expect(poise?.xp).toBe(0);  // XP reset
  });

  it("does not advance Veteran's Poise on success", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    player.mentalSkills = [makeSkill({ skillId: "veteran_poise", rank: 2 })];
    triggerReinvention(player, 8);
    resolveReinventionOutcome(player, { avg: 0.260 }, 8);

    const poise = player.mentalSkills?.find((s) => s.skillId === "veteran_poise");
    expect(poise?.rank).toBe(2); // unchanged
  });

  it("does not advance Veteran's Poise if already rank 5", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    player.mentalSkills = [makeSkill({ skillId: "veteran_poise", rank: 5 })];
    triggerReinvention(player, 8);
    resolveReinventionOutcome(player, { avg: 0.190 }, 8);

    const poise = player.mentalSkills?.find((s) => s.skillId === "veteran_poise");
    expect(poise?.rank).toBe(5); // can't go higher
  });
});

// ---------------------------------------------------------------------------
// Cannot reinvent twice
// ---------------------------------------------------------------------------

describe("Cannot reinvent twice", () => {
  it("second triggerReinvention throws after first", () => {
    const player = playerWithSignature({ age: 31, seasonsPlayed: 8 });
    triggerReinvention(player, 8);
    expect(() => triggerReinvention(player, 9)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Narrative helpers
// ---------------------------------------------------------------------------

describe("Narrative helpers", () => {
  it("narrativeReinventionTrigger includes player name", () => {
    const text = narrativeReinventionTrigger("Rivera");
    expect(text).toContain("Rivera");
    expect(text.length).toBeGreaterThan(0);
  });

  it("narrativeReinventionOutcome success line is non-empty", () => {
    const text = narrativeReinventionOutcome("Rivera", "success");
    expect(text.length).toBeGreaterThan(0);
  });

  it("narrativeReinventionOutcome failure line is non-empty", () => {
    const text = narrativeReinventionOutcome("Rivera", "failure");
    expect(text.length).toBeGreaterThan(0);
  });

  it("success and failure narratives are different", () => {
    const success = narrativeReinventionOutcome("Rivera", "success");
    const failure = narrativeReinventionOutcome("Rivera", "failure");
    expect(success).not.toBe(failure);
  });
});
