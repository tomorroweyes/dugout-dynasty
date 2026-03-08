/**
 * Tests for reputationSystem.ts — Issue #31
 */

import { describe, it, expect } from "vitest";
import type { Player } from "@/types/game";
import type { OpponentIntel } from "@/types/reputation";
import type { BadHabit } from "@/types/badHabits";
import type { SignatureSkill } from "@/types/breakthroughs";
import {
  getOrCreateOpponentIntel,
  recordGameVsOpponent,
  calculateScoutTier,
  calculateOpponentAdaptation,
  applyReputationPenalty,
  applySignatureReputationPenalty,
  applyOffSeasonReputationDecay,
  applyReinventionReputationReset,
  applyTradeReputationReset,
  narrativeOffSeasonReset,
} from "@/engine/reputationSystem";
import {
  SCOUT_TIER_THRESHOLDS,
  ADAPTATION_EFFECT,
} from "@/types/reputation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-rep-001",
    name: "Rivera",
    surname: "Rivera",
    role: "Batter",
    stats: { power: 70, contact: 75, glove: 60, speed: 65 },
    salary: 5000,
    level: 6,
    xp: 600,
    totalXpEarned: 3000,
    equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    spirit: { current: 80, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...overrides,
  };
}

function makePullHabitAboveThreshold(playerId: string, strength = 80): BadHabit {
  return {
    habitId: `pull-habit-${playerId}`,
    habitType: "pull_happy",
    formationType: "skill_streak",
    strength,
    isActive: true,
    consecutiveUses: 10,
    consecutiveNonUses: 0,
    formedAtGame: 1,
    opponentKnowledge: 0,
  };
}

function makeChaseArtistHabit(playerId: string, strength = 70): BadHabit {
  return {
    habitId: `chase-habit-${playerId}`,
    habitType: "chase_artist",
    formationType: "approach_streak",
    strength,
    isActive: true,
    consecutiveUses: 8,
    consecutiveNonUses: 0,
    formedAtGame: 2,
    opponentKnowledge: 0,
  };
}

function makeSignatureSkill(playerName: string, skillName = `${playerName}'s Scalpel`): SignatureSkill {
  return {
    signatureId: "sig-001",
    skillId: "ice_veins",
    playerId: "p-rep-001",
    skillName,
    effectBonus: 0.10,
    unlockedAt: {} as any,
    isActive: true,
    isArchived: false,
    reputation: {
      knownBy: [],
      counterStrategies: [],
      scoutLevel: 0,
      highLeverageUses: 0,
    },
  };
}

function makeIntel(overrides: Partial<OpponentIntel> = {}): OpponentIntel {
  return {
    opponentId: "team-steel-city",
    opponentName: "Steel City Rollers",
    gamesPlayed: 0,
    currentSeasonGames: 0,
    scoutTier: 0,
    knownHabitIds: [],
    counterStrategies: [],
    lastMetSeason: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getOrCreateOpponentIntel
// ---------------------------------------------------------------------------

describe("getOrCreateOpponentIntel", () => {
  it("creates fresh intel at Tier 0", () => {
    const player = makePlayer();
    const intel = getOrCreateOpponentIntel(player, "team-001", "Rollers", 5);
    expect(intel.scoutTier).toBe(0);
    expect(intel.gamesPlayed).toBe(0);
  });

  it("returns existing intel record without resetting it", () => {
    const player = makePlayer();
    const first = getOrCreateOpponentIntel(player, "team-001", "Rollers", 5);
    first.gamesPlayed = 7;
    const second = getOrCreateOpponentIntel(player, "team-001", "Rollers", 5);
    expect(second.gamesPlayed).toBe(7); // Same reference
  });

  it("creates separate records for different opponents", () => {
    const player = makePlayer();
    const intel1 = getOrCreateOpponentIntel(player, "team-A", "Team A", 5);
    const intel2 = getOrCreateOpponentIntel(player, "team-B", "Team B", 5);
    expect(player.opponentIntel?.length).toBe(2);
    expect(intel1.opponentId).not.toBe(intel2.opponentId);
  });
});

// ---------------------------------------------------------------------------
// calculateScoutTier
// ---------------------------------------------------------------------------

describe("calculateScoutTier", () => {
  it("returns 0 for first encounter (0 games)", () => {
    const intel = makeIntel({ gamesPlayed: 0, currentSeasonGames: 0, lastMetSeason: 5 });
    expect(calculateScoutTier(intel, 5, false, 0)).toBe(0);
  });

  it("returns 1 after 3 games vs opponent", () => {
    const intel = makeIntel({ gamesPlayed: 3, currentSeasonGames: 3, lastMetSeason: 5 });
    expect(calculateScoutTier(intel, 5, false, 5)).toBe(1);
  });

  it("returns 2 mid-season (game 10+) with 3+ opponent games", () => {
    const intel = makeIntel({ gamesPlayed: 4, currentSeasonGames: 4, lastMetSeason: 5 });
    expect(calculateScoutTier(intel, 5, false, 10)).toBe(2);
  });

  it("returns 3 in playoffs", () => {
    const intel = makeIntel({ gamesPlayed: 2, currentSeasonGames: 2, lastMetSeason: 5 });
    expect(calculateScoutTier(intel, 5, true, 5)).toBe(3);
  });

  it("returns 3 in 2nd season vs same opponent", () => {
    // lastMetSeason was 4, now it's season 5
    const intel = makeIntel({ gamesPlayed: 5, currentSeasonGames: 1, lastMetSeason: 4 });
    expect(calculateScoutTier(intel, 5, false, 1)).toBe(3);
  });

  it("does not return Tier 2 if only < 3 opponent games even mid-season", () => {
    const intel = makeIntel({ gamesPlayed: 2, currentSeasonGames: 2, lastMetSeason: 5 });
    // 2 games is below Tier 1 threshold (3) — stays at Tier 0 even mid-season
    expect(calculateScoutTier(intel, 5, false, 15)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recordGameVsOpponent
// ---------------------------------------------------------------------------

describe("recordGameVsOpponent", () => {
  it("increments gamesPlayed and currentSeasonGames", () => {
    const player = makePlayer();
    const intel = recordGameVsOpponent(player, "team-A", "Team A", 5, false, 1);
    expect(intel.gamesPlayed).toBe(1);
    expect(intel.currentSeasonGames).toBe(1);
  });

  it("escalates to Tier 1 at 3 games", () => {
    const player = makePlayer();
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 1);
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 2);
    const intel = recordGameVsOpponent(player, "team-A", "Team A", 5, false, 3);
    expect(intel.scoutTier).toBeGreaterThanOrEqual(1);
  });

  it("updates lastMetSeason", () => {
    const player = makePlayer();
    const intel = recordGameVsOpponent(player, "team-A", "Team A", 8, false, 5);
    expect(intel.lastMetSeason).toBe(8);
  });

  it("tracks top active habit at Tier 1 if strength > 75", () => {
    const player = makePlayer();
    const habit = makePullHabitAboveThreshold(player.id, 80);
    player.badHabits = [habit];
    // 3 games to reach Tier 1
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 1);
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 2);
    const intel = recordGameVsOpponent(player, "team-A", "Team A", 5, false, 3);
    expect(intel.knownHabitIds).toContain(habit.habitId);
  });

  it("does not reveal habit below strength threshold at Tier 1", () => {
    const player = makePlayer();
    // habit strength 60 — below 75 threshold
    const habit = makePullHabitAboveThreshold(player.id, 60);
    player.badHabits = [habit];
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 1);
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 2);
    const intel = recordGameVsOpponent(player, "team-A", "Team A", 5, false, 3);
    expect(intel.knownHabitIds).not.toContain(habit.habitId);
  });

  it("reveals signature skill name at Tier 2", () => {
    const player = makePlayer();
    const sig = makeSignatureSkill(player.name, "Rivera's Scalpel");
    player.signatureSkills = new Map([["sig-001", sig]]);
    // 4 games into season 10+ → Tier 2
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 1);
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 2);
    recordGameVsOpponent(player, "team-A", "Team A", 5, false, 3);
    const intel = recordGameVsOpponent(player, "team-A", "Team A", 5, false, 12);
    expect(intel.knownSignatureName).toBe("Rivera's Scalpel");
  });
});

// ---------------------------------------------------------------------------
// calculateOpponentAdaptation
// ---------------------------------------------------------------------------

describe("calculateOpponentAdaptation", () => {
  it("returns no adaptation at Tier 0", () => {
    const player = makePlayer();
    const intel = makeIntel({ scoutTier: 0 });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.infielderShift).toBe(false);
    expect(adapt.signatureCountered).toBe(false);
    expect(adapt.fullCounter).toBe(false);
  });

  it("applies infield shift at Tier 1 with known pull_happy habit", () => {
    const player = makePlayer();
    const habit = makePullHabitAboveThreshold(player.id);
    player.badHabits = [habit];
    const intel = makeIntel({
      scoutTier: 1,
      knownHabitIds: [habit.habitId],
    });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.infielderShift).toBe(true);
  });

  it("does NOT apply infield shift if habit not in knownHabitIds", () => {
    const player = makePlayer();
    const habit = makePullHabitAboveThreshold(player.id);
    player.badHabits = [habit];
    const intel = makeIntel({
      scoutTier: 1,
      knownHabitIds: [], // habit not known yet
    });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.infielderShift).toBe(false);
  });

  it("applies off-speed bias at Tier 1 with known chase_artist habit", () => {
    const player = makePlayer();
    const habit = makeChaseArtistHabit(player.id);
    player.badHabits = [habit];
    const intel = makeIntel({
      scoutTier: 1,
      knownHabitIds: [habit.habitId],
    });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.offSpeedBias).toBe(true);
  });

  it("counters signature at Tier 2 when opponent knows it", () => {
    const player = makePlayer();
    const sig = makeSignatureSkill(player.name, "Rivera's Scalpel");
    player.signatureSkills = new Map([["sig-001", sig]]);
    const intel = makeIntel({
      scoutTier: 2,
      knownSignatureName: "Rivera's Scalpel",
    });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.signatureCountered).toBe(true);
  });

  it("does NOT counter signature at Tier 1", () => {
    const player = makePlayer();
    const sig = makeSignatureSkill(player.name);
    player.signatureSkills = new Map([["sig-001", sig]]);
    const intel = makeIntel({
      scoutTier: 1,
      knownSignatureName: "Rivera's Scalpel",
    });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.signatureCountered).toBe(false);
  });

  it("applies full counter at Tier 3", () => {
    const player = makePlayer();
    const intel = makeIntel({ scoutTier: 3 });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.fullCounter).toBe(true);
  });

  it("includes adaptation narrative when shift applied", () => {
    const player = makePlayer();
    const habit = makePullHabitAboveThreshold(player.id);
    player.badHabits = [habit];
    const intel = makeIntel({
      scoutTier: 1,
      knownHabitIds: [habit.habitId],
    });
    const adapt = calculateOpponentAdaptation(player, intel);
    expect(adapt.adaptationNarrative).toBeDefined();
    expect(adapt.adaptationNarrative!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// applyReputationPenalty
// ---------------------------------------------------------------------------

describe("applyReputationPenalty", () => {
  it("no change when no adaptation", () => {
    const adapt = {
      infielderShift: false,
      offSpeedBias: false,
      signatureCountered: false,
      fullCounter: false,
    };
    expect(applyReputationPenalty(0.300, adapt)).toBeCloseTo(0.300);
  });

  it("reduces hit prob by 15% with infield shift", () => {
    const adapt = {
      infielderShift: true,
      offSpeedBias: false,
      signatureCountered: false,
      fullCounter: false,
    };
    const result = applyReputationPenalty(0.300, adapt);
    expect(result).toBeCloseTo(0.300 - ADAPTATION_EFFECT.pullHabitHitReduction);
  });

  it("reduces hit prob by 5% with full counter", () => {
    const adapt = {
      infielderShift: false,
      offSpeedBias: false,
      signatureCountered: false,
      fullCounter: true,
    };
    const result = applyReputationPenalty(0.300, adapt);
    expect(result).toBeCloseTo(0.300 - ADAPTATION_EFFECT.tier3SignatureExtra);
  });

  it("stacks shift and full counter penalties", () => {
    const adapt = {
      infielderShift: true,
      offSpeedBias: false,
      signatureCountered: false,
      fullCounter: true,
    };
    const result = applyReputationPenalty(0.300, adapt);
    expect(result).toBeCloseTo(0.300 - 0.15 - 0.05);
  });

  it("clamps to 0 minimum", () => {
    const adapt = {
      infielderShift: true,
      offSpeedBias: false,
      signatureCountered: false,
      fullCounter: true,
    };
    expect(applyReputationPenalty(0.10, adapt)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// applySignatureReputationPenalty
// ---------------------------------------------------------------------------

describe("applySignatureReputationPenalty", () => {
  it("no change when signature not countered", () => {
    const adapt = {
      infielderShift: false,
      offSpeedBias: false,
      signatureCountered: false,
      fullCounter: false,
    };
    expect(applySignatureReputationPenalty(1.10, adapt)).toBeCloseTo(1.10);
  });

  it("reduces signature effect by 10% when countered", () => {
    const adapt = {
      infielderShift: false,
      offSpeedBias: false,
      signatureCountered: true,
      fullCounter: false,
    };
    expect(applySignatureReputationPenalty(1.10, adapt)).toBeCloseTo(1.00);
  });
});

// ---------------------------------------------------------------------------
// applyOffSeasonReputationDecay
// ---------------------------------------------------------------------------

describe("applyOffSeasonReputationDecay", () => {
  it("does nothing when no opponentIntel", () => {
    const player = makePlayer();
    expect(() => applyOffSeasonReputationDecay(player)).not.toThrow();
  });

  it("drops Tier 3 → Tier 1", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ scoutTier: 3 }),
    ];
    applyOffSeasonReputationDecay(player);
    expect(player.opponentIntel[0].scoutTier).toBe(1);
  });

  it("leaves Tier 0, 1, 2 unchanged", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ opponentId: "a", scoutTier: 0 }),
      makeIntel({ opponentId: "b", scoutTier: 1 }),
      makeIntel({ opponentId: "c", scoutTier: 2 }),
    ];
    applyOffSeasonReputationDecay(player);
    expect(player.opponentIntel[0].scoutTier).toBe(0);
    expect(player.opponentIntel[1].scoutTier).toBe(1);
    expect(player.opponentIntel[2].scoutTier).toBe(2);
  });

  it("clears counter strategies on Tier 3 decay", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ scoutTier: 3, counterStrategies: ["Shift right", "Pitch low"] }),
    ];
    applyOffSeasonReputationDecay(player);
    expect(player.opponentIntel[0].counterStrategies).toEqual([]);
  });

  it("resets currentSeasonGames for all opponents", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ scoutTier: 2, currentSeasonGames: 12 }),
    ];
    applyOffSeasonReputationDecay(player);
    expect(player.opponentIntel[0].currentSeasonGames).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyReinventionReputationReset
// ---------------------------------------------------------------------------

describe("applyReinventionReputationReset", () => {
  it("resets all opponents to Tier 0", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ opponentId: "a", scoutTier: 1 }),
      makeIntel({ opponentId: "b", scoutTier: 3 }),
    ];
    applyReinventionReputationReset(player);
    for (const intel of player.opponentIntel!) {
      expect(intel.scoutTier).toBe(0);
    }
  });

  it("clears knownHabitIds on all opponents", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ scoutTier: 2, knownHabitIds: ["habit-1", "habit-2"] }),
    ];
    applyReinventionReputationReset(player);
    expect(player.opponentIntel![0].knownHabitIds).toEqual([]);
  });

  it("clears knownSignatureName", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ scoutTier: 2, knownSignatureName: "Rivera's Scalpel" }),
    ];
    applyReinventionReputationReset(player);
    expect(player.opponentIntel![0].knownSignatureName).toBeUndefined();
  });

  it("returns list of opponent names that were reset", () => {
    const player = makePlayer();
    player.opponentIntel = [
      makeIntel({ opponentId: "a", opponentName: "Rollers", scoutTier: 2 }),
      makeIntel({ opponentId: "b", opponentName: "Sharks", scoutTier: 1 }),
      makeIntel({ opponentId: "c", opponentName: "Eagles", scoutTier: 0 }),
    ];
    const reset = applyReinventionReputationReset(player);
    expect(reset).toContain("Rollers");
    expect(reset).toContain("Sharks");
    // Eagles was Tier 0 — skipped
    expect(reset).not.toContain("Eagles");
  });

  it("returns empty array when no opponentIntel", () => {
    const player = makePlayer();
    const reset = applyReinventionReputationReset(player);
    expect(reset).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyTradeReputationReset
// ---------------------------------------------------------------------------

describe("applyTradeReputationReset", () => {
  it("clears all opponent intel on trade", () => {
    const player = makePlayer();
    player.opponentIntel = [makeIntel({ scoutTier: 3 })];
    applyTradeReputationReset(player);
    expect(player.opponentIntel).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

describe("narrativeOffSeasonReset", () => {
  it("returns a non-empty string containing player name", () => {
    const text = narrativeOffSeasonReset("Rivera");
    expect(text).toContain("Rivera");
    expect(text.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Adaptation effect constants
// ---------------------------------------------------------------------------

describe("Adaptation constants", () => {
  it("pull habit hit reduction is 15%", () => {
    expect(ADAPTATION_EFFECT.pullHabitHitReduction).toBe(0.15);
  });

  it("signature effect reduction is 10%", () => {
    expect(ADAPTATION_EFFECT.signatureEffectReduction).toBe(0.10);
  });

  it("tier 3 extra is 5%", () => {
    expect(ADAPTATION_EFFECT.tier3SignatureExtra).toBe(0.05);
  });

  it("scout tier 1 requires 3 games", () => {
    expect(SCOUT_TIER_THRESHOLDS.tier1GamesRequired).toBe(3);
  });

  it("scout tier 2 requires game 10+", () => {
    expect(SCOUT_TIER_THRESHOLDS.tier2SeasonGame).toBe(10);
  });

  it("habit must have strength > 75 to be revealed at Tier 1", () => {
    expect(SCOUT_TIER_THRESHOLDS.tier1HabitStrengthRequired).toBe(75);
  });
});
