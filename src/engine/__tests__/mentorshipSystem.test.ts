/**
 * Tests for mentorshipSystem.ts — Issues #36, #37
 */

import { describe, it, expect } from "vitest";
import type { Player } from "@/types/game";
import type { SignatureSkill } from "@/types/breakthroughs";
import {
  checkMentorEligibility,
  createMentorship,
  resolveStyleTransfer,
  applyMentorshipXPModifiers,
  endMentorship,
  renewMentorship,
  addLineageNode,
  buildLineageChain,
  applyLegacyBonus,
  getStyleTransferDiscoveryBonus,
  generateLegacyNarrative,
} from "@/engine/mentorshipSystem";
import {
  MENTORSHIP_MIN_AGE_GAP,
  MENTOR_XP_MULTIPLIER,
  APPRENTICE_XP_MULTIPLIER,
  STYLE_TRANSFER_COUNT,
  SEEDED_HABIT_STRENGTH,
  LEGACY_BONUS_PER_GENERATION,
  LEGACY_BONUS_CAP,
} from "@/types/mentorship";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-default",
    name: "Player",
    surname: "Player",
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

function makeMentor(name = "Rivera"): Player {
  const mentor = makePlayer({
    id: `p-mentor-${name}`,
    name,
    age: 35,
  });
  // Add active signature skill
  const sig: SignatureSkill = {
    signatureId: `sig-${name}`,
    skillId: "ice_veins",
    playerId: mentor.id,
    skillName: `${name}'s Scalpel`,
    effectBonus: 0.10,
    unlockedAt: {} as any,
    isActive: true,
    isArchived: false,
    reputation: { knownBy: [], counterStrategies: [], scoutLevel: 0, highLeverageUses: 0 },
  };
  mentor.signatureSkills = new Map([[sig.signatureId, sig]]);
  return mentor;
}

function makeApprentice(name = "Chen"): Player {
  return makePlayer({
    id: `p-apprentice-${name}`,
    name,
    age: 22,
  });
}

/** Always-positive RNG */
const alwaysPositiveRng = () => 0.0; // 0.0 < 0.70 → positive

/** Always-negative RNG */
const alwaysNegativeRng = () => 1.0; // 1.0 >= 0.70 → negative

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Mentorship constants", () => {
  it("minimum age gap is 5", () => {
    expect(MENTORSHIP_MIN_AGE_GAP).toBe(5);
  });

  it("mentor XP multiplier is 0.80 (-20%)", () => {
    expect(MENTOR_XP_MULTIPLIER).toBe(0.80);
  });

  it("apprentice XP multiplier is 1.40 (+40%)", () => {
    expect(APPRENTICE_XP_MULTIPLIER).toBe(1.40);
  });

  it("style transfer count is 3", () => {
    expect(STYLE_TRANSFER_COUNT).toBe(3);
  });

  it("seeded habit strength is 5", () => {
    expect(SEEDED_HABIT_STRENGTH).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// checkMentorEligibility
// ---------------------------------------------------------------------------

describe("checkMentorEligibility", () => {
  it("returns true when all conditions met", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    expect(checkMentorEligibility(mentor, apprentice)).toBe(true);
  });

  it("returns false when age gap < 5", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    mentor.age = 26; // only 4 years older than 22
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });

  it("returns false when mentor has no signature skill", () => {
    const mentor = makeMentor();
    mentor.signatureSkills = new Map(); // empty
    const apprentice = makeApprentice();
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });

  it("returns false when mentor already in a pair", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const fakeApprentice = makeApprentice("Fake");
    // Put mentor in a pair
    mentor.activeMentorship = {
      pairId: "old-pair",
      mentorId: mentor.id,
      apprenticeId: fakeApprentice.id,
      season: 4,
      styleTransfers: [],
      isActive: true,
      renewedSeasons: [],
    };
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });

  it("returns false when apprentice already in a pair", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    apprentice.activeMentorship = {
      pairId: "other-pair",
      mentorId: "p-other",
      apprenticeId: apprentice.id,
      season: 4,
      styleTransfers: [],
      isActive: true,
      renewedSeasons: [],
    };
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });

  it("returns false when mentor's signature is archived (not active)", () => {
    const mentor = makeMentor();
    // Archive the signature
    const sig = mentor.signatureSkills?.values().next().value;
    if (sig) {
      sig.isActive = false;
      sig.isArchived = true;
    }
    const apprentice = makeApprentice();
    expect(checkMentorEligibility(mentor, apprentice)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createMentorship
// ---------------------------------------------------------------------------

describe("createMentorship", () => {
  it("creates pair with correct mentor/apprentice IDs", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const pair = createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    expect(pair.mentorId).toBe(mentor.id);
    expect(pair.apprenticeId).toBe(apprentice.id);
  });

  it("stores pair on both players", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    expect(mentor.activeMentorship).toBeTruthy();
    expect(apprentice.activeMentorship).toBeTruthy();
  });

  it("pair starts as isActive=true", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const pair = createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    expect(pair.isActive).toBe(true);
  });

  it("resolves STYLE_TRANSFER_COUNT transfers", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const pair = createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    expect(pair.styleTransfers.length).toBe(STYLE_TRANSFER_COUNT);
  });

  it("adds lineage node to apprentice", () => {
    const mentor = makeMentor("Gomez");
    const apprentice = makeApprentice("Huang");
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    expect(apprentice.lineage).toBeTruthy();
    expect(apprentice.lineage?.[0].playerName).toBe("Gomez");
    expect(apprentice.lineage?.[0].generation).toBe(1);
  });

  it("throws when not eligible", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    mentor.age = 24; // too young
    expect(() => createMentorship(mentor, apprentice, 5)).toThrow();
  });

  it("stores pair in mentorshipHistory on both players", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    expect(mentor.mentorshipHistory?.length).toBeGreaterThanOrEqual(1);
    expect(apprentice.mentorshipHistory?.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// resolveStyleTransfer
// ---------------------------------------------------------------------------

describe("resolveStyleTransfer", () => {
  it("always returns STYLE_TRANSFER_COUNT transfers", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysPositiveRng);
    expect(transfers.length).toBe(STYLE_TRANSFER_COUNT);
  });

  it("all positive with always-positive RNG", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysPositiveRng);
    expect(transfers.every((t) => t.type === "positive")).toBe(true);
  });

  it("all negative with always-negative RNG", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysNegativeRng);
    expect(transfers.every((t) => t.type === "negative")).toBe(true);
  });

  it("positive transfer has discovery_bonus mechanicEffect", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysPositiveRng);
    expect(transfers[0].mechanicEffect).toMatch(/^discovery_bonus:/);
  });

  it("negative transfer has seed_habit mechanicEffect", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysNegativeRng);
    expect(transfers[0].mechanicEffect).toMatch(/^seed_habit:/);
  });

  it("negative transfer sets magnitude to SEEDED_HABIT_STRENGTH", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysNegativeRng);
    expect(transfers[0].magnitude).toBe(SEEDED_HABIT_STRENGTH);
  });

  it("positive transfer magnitude is 0.05 (5%)", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const transfers = resolveStyleTransfer(mentor, apprentice, alwaysPositiveRng);
    expect(transfers[0].magnitude).toBeCloseTo(0.05);
  });
});

// ---------------------------------------------------------------------------
// Negative style transfer — bad habit seeding
// ---------------------------------------------------------------------------

describe("Negative style transfer habit seeding", () => {
  it("seeds bad habit on apprentice with strength SEEDED_HABIT_STRENGTH", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysNegativeRng);
    expect(apprentice.badHabits?.length).toBeGreaterThan(0);
    const seeded = apprentice.badHabits?.find((h) => h.strength === SEEDED_HABIT_STRENGTH);
    expect(seeded).toBeTruthy();
  });

  it("seeded habit starts as isActive=false (below activation threshold)", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysNegativeRng);
    const seeded = apprentice.badHabits?.[0];
    expect(seeded?.isActive).toBe(false);
  });

  it("does not seed duplicate habit type", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    // Give apprentice the same habit type already
    apprentice.badHabits = [
      {
        habitId: "existing",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 60,
        isActive: true,
        consecutiveUses: 8,
        consecutiveNonUses: 0,
        formedAtGame: 1,
        opponentKnowledge: 0,
      },
    ];
    createMentorship(mentor, apprentice, 5, alwaysNegativeRng);
    const pullHabitCount = apprentice.badHabits?.filter((h) => h.habitType === "pull_happy").length ?? 0;
    expect(pullHabitCount).toBe(1); // Not duplicated
  });
});

// ---------------------------------------------------------------------------
// applyMentorshipXPModifiers
// ---------------------------------------------------------------------------

describe("applyMentorshipXPModifiers", () => {
  it("returns 1.0 when player has no active mentorship", () => {
    const player = makePlayer();
    const result = applyMentorshipXPModifiers(player, {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: true,
    });
    expect(result).toBe(1.0);
  });

  it("returns MENTOR_XP_MULTIPLIER for mentor when both in lineup", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const result = applyMentorshipXPModifiers(mentor, {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: true,
    });
    expect(result).toBe(MENTOR_XP_MULTIPLIER);
  });

  it("returns APPRENTICE_XP_MULTIPLIER for apprentice when both in lineup", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const result = applyMentorshipXPModifiers(apprentice, {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: true,
    });
    expect(result).toBe(APPRENTICE_XP_MULTIPLIER);
  });

  it("returns 1.0 when mentor is benched (not in roster)", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const result = applyMentorshipXPModifiers(apprentice, {
      mentorInActiveRoster: false, // mentor benched
      apprenticeInActiveRoster: true,
    });
    expect(result).toBe(1.0);
  });

  it("returns 1.0 when apprentice is benched", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const result = applyMentorshipXPModifiers(mentor, {
      mentorInActiveRoster: true,
      apprenticeInActiveRoster: false, // apprentice benched
    });
    expect(result).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// endMentorship / renewMentorship
// ---------------------------------------------------------------------------

describe("endMentorship", () => {
  it("sets isActive=false on the pair", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const pair = createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    endMentorship(mentor, apprentice);
    expect(pair.isActive).toBe(false);
  });

  it("clears activeMentorship from both players", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    endMentorship(mentor, apprentice);
    expect(mentor.activeMentorship).toBeUndefined();
    expect(apprentice.activeMentorship).toBeUndefined();
  });
});

describe("renewMentorship", () => {
  it("creates a new active pair for the renewal season", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    endMentorship(mentor, apprentice);
    const renewed = renewMentorship(mentor, apprentice, 6, alwaysPositiveRng);
    expect(renewed.isActive).toBe(true);
    expect(renewed.season).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------

describe("addLineageNode", () => {
  it("adds mentor as generation 1 node", () => {
    const mentor = makeMentor("Gomez");
    const apprentice = makeApprentice("Huang");
    addLineageNode(apprentice, mentor);
    expect(apprentice.lineage?.[0].generation).toBe(1);
    expect(apprentice.lineage?.[0].playerName).toBe("Gomez");
  });

  it("shifts existing nodes when a new mentor is added", () => {
    const grandMentor = makeMentor("Old");
    const mentor = makeMentor("Mid");
    const apprentice = makeApprentice("Young");
    addLineageNode(apprentice, grandMentor); // gen 1
    addLineageNode(apprentice, mentor);      // pushes grandMentor to gen 2
    expect(apprentice.lineage?.[0].playerName).toBe("Mid");
    expect(apprentice.lineage?.[1].playerName).toBe("Old");
    expect(apprentice.lineage?.[1].generation).toBe(2);
  });

  it("caps chain at 3 generations", () => {
    const p1 = makeMentor("Gen1");
    const p2 = makeMentor("Gen2");
    const p3 = makeMentor("Gen3");
    const p4 = makeMentor("Gen4");
    const apprentice = makeApprentice("Young");
    addLineageNode(apprentice, p1);
    addLineageNode(apprentice, p2);
    addLineageNode(apprentice, p3);
    addLineageNode(apprentice, p4); // p1 should fall off
    expect(apprentice.lineage?.length).toBeLessThanOrEqual(3);
  });
});

describe("buildLineageChain", () => {
  it("returns empty chain when no mentorship history", () => {
    const player = makePlayer();
    const result = buildLineageChain(player, new Map());
    expect(result).toEqual([]);
  });

  it("returns mentor as generation 1 node", () => {
    const mentor = makeMentor("Gomez");
    const apprentice = makeApprentice("Huang");
    const playerMap = new Map([
      [mentor.id, mentor],
      [apprentice.id, apprentice],
    ]);
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const chain = buildLineageChain(apprentice, playerMap);
    expect(chain.length).toBeGreaterThanOrEqual(1);
    expect(chain[0].playerName).toBe("Gomez");
    expect(chain[0].generation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyLegacyBonus
// ---------------------------------------------------------------------------

describe("applyLegacyBonus", () => {
  it("returns 0 when no lineage", () => {
    const player = makePlayer();
    expect(applyLegacyBonus(player, "ice_veins")).toBe(0);
  });

  it("legacy bonus constants are correct", () => {
    expect(LEGACY_BONUS_PER_GENERATION).toBe(0.05);
    expect(LEGACY_BONUS_CAP).toBe(0.20);
  });
});

// ---------------------------------------------------------------------------
// getStyleTransferDiscoveryBonus
// ---------------------------------------------------------------------------

describe("getStyleTransferDiscoveryBonus", () => {
  it("returns 0 when no positive transfers for skill", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const pair = createMentorship(mentor, apprentice, 5, alwaysNegativeRng);
    expect(getStyleTransferDiscoveryBonus(pair, "ice_veins")).toBe(0);
  });

  it("returns cumulative bonus for positive transfers", () => {
    const mentor = makeMentor();
    const apprentice = makeApprentice();
    const pair = createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    // All 3 transfers are positive for ice_veins (from signature)
    const bonus = getStyleTransferDiscoveryBonus(pair, "ice_veins");
    expect(bonus).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateLegacyNarrative
// ---------------------------------------------------------------------------

describe("generateLegacyNarrative", () => {
  it("returns empty string when no lineage", () => {
    const player = makePlayer({ name: "Huang" });
    expect(generateLegacyNarrative(player, "ice_veins")).toBe("");
  });

  it("includes player name in narrative", () => {
    const mentor = makeMentor("Gomez");
    const apprentice = makeApprentice("Huang");
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const text = generateLegacyNarrative(apprentice, "ice_veins");
    expect(text).toContain("Huang");
  });

  it("includes mentor name in 1-gen narrative", () => {
    const mentor = makeMentor("Gomez");
    const apprentice = makeApprentice("Huang");
    createMentorship(mentor, apprentice, 5, alwaysPositiveRng);
    const text = generateLegacyNarrative(apprentice, "ice_veins");
    expect(text).toContain("Gomez");
  });

  it("uses 3-gen template when chain is long", () => {
    // Build 3-gen lineage manually
    const apprentice = makePlayer({ name: "Young", id: "young" });
    apprentice.lineage = [
      { playerId: "gen1", playerName: "Gen1", generation: 1 },
      { playerId: "gen2", playerName: "Gen2", generation: 2 },
      { playerId: "gen3", playerName: "Gen3", generation: 3 },
    ];
    const text = generateLegacyNarrative(apprentice, "ice_veins");
    expect(text.length).toBeGreaterThan(0);
    // 3-gen text should include "generations" or "lineage" or "chapter"
    expect(text).toMatch(/generation|lineage|chapter|passed|tradition/i);
  });
});
