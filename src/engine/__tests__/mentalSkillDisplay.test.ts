/**
 * Tests for mentalSkillDisplay.ts helper functions
 *
 * Pure function tests — no React, no DOM. Covers:
 *   - getSkillDisplayState
 *   - getSkillRank
 *   - getSkillConfidence
 *   - getActiveSignatureSkill / getArchivedSignatureSkills
 *   - polarToCartesian geometry
 *   - buildRadarPoints
 *   - buildReferenceRingPoints
 *   - getMentalSkillSummary
 */

import { describe, it, expect } from "vitest";
import type { Player } from "@/types/game";
import type { MentalSkill } from "@/types/mentalSkills";
import { CONFIDENCE_ACTIVE_THRESHOLD } from "@/types/mentalSkills";
import type { SignatureSkill } from "@/types/breakthroughs";
import {
  getSkillDisplayState,
  getSkillRank,
  getSkillConfidence,
  getActiveSignatureSkill,
  getArchivedSignatureSkills,
  polarToCartesian,
  buildRadarPoints,
  buildReferenceRingPoints,
  getMentalSkillSummary,
  COMPASS_AXES,
} from "../mentalSkillDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeSkill(overrides: Partial<MentalSkill>): MentalSkill {
  return {
    skillId: "ice_veins",
    rank: 1,
    xp: 10,
    xpToNextRank: 60,
    confidence: CONFIDENCE_ACTIVE_THRESHOLD,
    lastTriggeredGame: 1,
    isActive: true,
    decayRate: 5,
    wasLapsed: false,
    ...overrides,
  };
}

/** Minimal Player stub — only the fields used by mentalSkillDisplay helpers */
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Test",
    surname: "Player",
    role: "Batter",
    stats: { power: 50, contact: 50, glove: 50, speed: 50 },
    salary: 100,
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    equipment: { bat: null, glove: null, cleats: null, helmet: null },
    spirit: { current: 0, max: 0 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...overrides,
  } as unknown as Player;
}

function makeSig(overrides: Partial<SignatureSkill> = {}): SignatureSkill {
  return {
    signatureId: "sig1",
    skillId: "ice_veins",
    playerId: "p1",
    skillName: "Rivera's Hammer",
    effectBonus: 0.1,
    unlockedAt: {} as SignatureSkill["unlockedAt"],
    isActive: true,
    isArchived: false,
    reputation: { knownBy: [], counterStrategies: [], scoutLevel: 0, highLeverageUses: 0 },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getSkillDisplayState
// ─────────────────────────────────────────────────────────────────────────────

describe("getSkillDisplayState", () => {
  it("returns 'undiscovered' when player has no mentalSkills", () => {
    const p = makePlayer({ mentalSkills: undefined });
    expect(getSkillDisplayState(p, "ice_veins")).toBe("undiscovered");
  });

  it("returns 'undiscovered' when mentalSkills array is empty", () => {
    const p = makePlayer({ mentalSkills: [] });
    expect(getSkillDisplayState(p, "ice_veins")).toBe("undiscovered");
  });

  it("returns 'undiscovered' when skill not in the array", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "pitch_recognition", confidence: 80 })],
    });
    expect(getSkillDisplayState(p, "ice_veins")).toBe("undiscovered");
  });

  it("returns 'active' when skill is discovered and confidence is exactly at threshold", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "ice_veins", confidence: CONFIDENCE_ACTIVE_THRESHOLD })],
    });
    expect(getSkillDisplayState(p, "ice_veins")).toBe("active");
  });

  it("returns 'active' when confidence is above threshold", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "clutch_composure", confidence: 85 })],
    });
    expect(getSkillDisplayState(p, "clutch_composure")).toBe("active");
  });

  it("returns 'dormant' when confidence is below threshold", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "veteran_poise", confidence: CONFIDENCE_ACTIVE_THRESHOLD - 1 })],
    });
    expect(getSkillDisplayState(p, "veteran_poise")).toBe("dormant");
  });

  it("returns 'dormant' when confidence is 0", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "game_reading", confidence: 0 })],
    });
    expect(getSkillDisplayState(p, "game_reading")).toBe("dormant");
  });

  it("correctly classifies all 5 skills independently", () => {
    const p = makePlayer({
      mentalSkills: [
        makeSkill({ skillId: "ice_veins",          confidence: 80 }),
        makeSkill({ skillId: "pitch_recognition",  confidence: 5 }),
        makeSkill({ skillId: "clutch_composure",   confidence: CONFIDENCE_ACTIVE_THRESHOLD }),
        // veteran_poise and game_reading not discovered
      ],
    });
    expect(getSkillDisplayState(p, "ice_veins")).toBe("active");
    expect(getSkillDisplayState(p, "pitch_recognition")).toBe("dormant");
    expect(getSkillDisplayState(p, "clutch_composure")).toBe("active");
    expect(getSkillDisplayState(p, "veteran_poise")).toBe("undiscovered");
    expect(getSkillDisplayState(p, "game_reading")).toBe("undiscovered");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSkillRank
// ─────────────────────────────────────────────────────────────────────────────

describe("getSkillRank", () => {
  it("returns 0 when skill is undiscovered", () => {
    const p = makePlayer({ mentalSkills: [] });
    expect(getSkillRank(p, "ice_veins")).toBe(0);
  });

  it("returns 0 when mentalSkills is undefined", () => {
    const p = makePlayer({ mentalSkills: undefined });
    expect(getSkillRank(p, "ice_veins")).toBe(0);
  });

  it("returns the actual rank when skill is discovered", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "ice_veins", rank: 3 })],
    });
    expect(getSkillRank(p, "ice_veins")).toBe(3);
  });

  it("returns rank 5 for maxed skill", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "game_reading", rank: 5 })],
    });
    expect(getSkillRank(p, "game_reading")).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSkillConfidence
// ─────────────────────────────────────────────────────────────────────────────

describe("getSkillConfidence", () => {
  it("returns 0 when skill is undiscovered", () => {
    const p = makePlayer({ mentalSkills: [] });
    expect(getSkillConfidence(p, "veteran_poise")).toBe(0);
  });

  it("returns the confidence value when discovered", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "veteran_poise", confidence: 72 })],
    });
    expect(getSkillConfidence(p, "veteran_poise")).toBe(72);
  });

  it("returns 0 confidence for a lapsed skill with 0 confidence", () => {
    const p = makePlayer({
      mentalSkills: [makeSkill({ skillId: "pitch_recognition", confidence: 0, wasLapsed: true })],
    });
    expect(getSkillConfidence(p, "pitch_recognition")).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getActiveSignatureSkill
// ─────────────────────────────────────────────────────────────────────────────

describe("getActiveSignatureSkill", () => {
  it("returns undefined when signatureSkills is undefined", () => {
    const p = makePlayer({ signatureSkills: undefined });
    expect(getActiveSignatureSkill(p)).toBeUndefined();
  });

  it("returns undefined when signatureSkills map is empty", () => {
    const p = makePlayer({ signatureSkills: new Map() });
    expect(getActiveSignatureSkill(p)).toBeUndefined();
  });

  it("returns the active signature skill", () => {
    const sig = makeSig({ signatureId: "sig1", isActive: true, isArchived: false });
    const m = new Map([["sig1", sig]]);
    const p = makePlayer({ signatureSkills: m });
    expect(getActiveSignatureSkill(p)).toBe(sig);
  });

  it("returns undefined when the only sig is archived", () => {
    const sig = makeSig({ signatureId: "sig1", isActive: true, isArchived: true });
    const m = new Map([["sig1", sig]]);
    const p = makePlayer({ signatureSkills: m });
    expect(getActiveSignatureSkill(p)).toBeUndefined();
  });

  it("returns undefined when the only sig is inactive", () => {
    const sig = makeSig({ signatureId: "sig1", isActive: false, isArchived: false });
    const m = new Map([["sig1", sig]]);
    const p = makePlayer({ signatureSkills: m });
    expect(getActiveSignatureSkill(p)).toBeUndefined();
  });

  it("returns active sig and ignores archived ones", () => {
    const archived = makeSig({ signatureId: "old", isActive: true, isArchived: true });
    const active   = makeSig({ signatureId: "new", isActive: true, isArchived: false });
    const m = new Map([["old", archived], ["new", active]]);
    const p = makePlayer({ signatureSkills: m });
    expect(getActiveSignatureSkill(p)).toBe(active);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getArchivedSignatureSkills
// ─────────────────────────────────────────────────────────────────────────────

describe("getArchivedSignatureSkills", () => {
  it("returns empty array when signatureSkills is undefined", () => {
    const p = makePlayer({ signatureSkills: undefined });
    expect(getArchivedSignatureSkills(p)).toEqual([]);
  });

  it("returns only archived skills", () => {
    const a1 = makeSig({ signatureId: "a1", isArchived: true });
    const a2 = makeSig({ signatureId: "a2", isArchived: true });
    const active = makeSig({ signatureId: "curr", isArchived: false });
    const m = new Map([["a1", a1], ["a2", a2], ["curr", active]]);
    const p = makePlayer({ signatureSkills: m });
    const result = getArchivedSignatureSkills(p);
    expect(result).toHaveLength(2);
    expect(result).toContain(a1);
    expect(result).toContain(a2);
    expect(result).not.toContain(active);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// polarToCartesian
// ─────────────────────────────────────────────────────────────────────────────

describe("polarToCartesian", () => {
  it("returns the center when radius is 0", () => {
    const { x, y } = polarToCartesian(100, 100, 0, 0);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(100);
  });

  it("returns correct point at 0 degrees (pointing right)", () => {
    const { x, y } = polarToCartesian(0, 0, 10, 0);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(0);
  });

  it("returns correct point at 90 degrees (pointing down in SVG space)", () => {
    const { x, y } = polarToCartesian(0, 0, 10, 90);
    expect(x).toBeCloseTo(0, 4);
    expect(y).toBeCloseTo(10);
  });

  it("returns correct point at -90 degrees (pointing up — top of pentagon)", () => {
    const { x, y } = polarToCartesian(100, 100, 80, -90);
    expect(x).toBeCloseTo(100, 4); // should be directly above center
    expect(y).toBeCloseTo(20);     // 100 - 80 = 20
  });

  it("offsets correctly from a non-zero center", () => {
    const { x, y } = polarToCartesian(50, 50, 10, 0);
    expect(x).toBeCloseTo(60);
    expect(y).toBeCloseTo(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRadarPoints
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRadarPoints", () => {
  it("returns 5 coordinate pairs (polygon has 5 points)", () => {
    const points = buildRadarPoints([5, 5, 5, 5, 5], 100, 100, 80);
    const pairs = points.trim().split(" ");
    expect(pairs).toHaveLength(5);
    for (const pair of pairs) {
      const [x, y] = pair.split(",").map(Number);
      expect(isNaN(x)).toBe(false);
      expect(isNaN(y)).toBe(false);
    }
  });

  it("all points at center when all ranks are 0", () => {
    const points = buildRadarPoints([0, 0, 0, 0, 0], 100, 100, 80);
    const pairs = points.trim().split(" ");
    for (const pair of pairs) {
      const [x, y] = pair.split(",").map(Number);
      expect(x).toBeCloseTo(100, 1);
      expect(y).toBeCloseTo(100, 1);
    }
  });

  it("top point (ice_veins at -90°) is directly above center when rank=5", () => {
    // Only first axis (ice_veins, -90°) at max rank, rest at 0
    const points = buildRadarPoints([5, 0, 0, 0, 0], 100, 100, 80);
    const pairs = points.trim().split(" ");
    const [x, y] = pairs[0].split(",").map(Number);
    expect(x).toBeCloseTo(100, 1);
    expect(y).toBeCloseTo(20, 1); // 100 - 80 = 20
  });

  it("uses maxR=0 for all ranks → all points at center", () => {
    const points = buildRadarPoints([5, 4, 3, 2, 1], 50, 50, 0);
    const pairs = points.trim().split(" ");
    for (const pair of pairs) {
      const [x, y] = pair.split(",").map(Number);
      expect(x).toBeCloseTo(50, 1);
      expect(y).toBeCloseTo(50, 1);
    }
  });

  it("missing rank defaults to 0 (handles sparse array)", () => {
    // Only 3 ranks provided; the other 2 should default to 0 (center)
    const points = buildRadarPoints([3, 3, 3] as number[], 100, 100, 80);
    const pairs = points.trim().split(" ");
    expect(pairs).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildReferenceRingPoints
// ─────────────────────────────────────────────────────────────────────────────

describe("buildReferenceRingPoints", () => {
  it("returns 5 point pairs for each reference ring", () => {
    for (const rank of [1, 2, 3, 4, 5] as const) {
      const points = buildReferenceRingPoints(100, 100, 80, rank);
      const pairs = points.trim().split(" ");
      expect(pairs).toHaveLength(5);
    }
  });

  it("rank-5 ring top point (ice_veins axis, -90°) is at maxR distance from center", () => {
    const points = buildReferenceRingPoints(100, 100, 80, 5);
    const pairs = points.trim().split(" ");
    const [x, y] = pairs[0].split(",").map(Number);
    expect(x).toBeCloseTo(100, 1);
    expect(y).toBeCloseTo(20, 1); // 100 - 80
  });

  it("rank-1 ring is 1/5 the radius of rank-5 ring", () => {
    const r1 = buildReferenceRingPoints(0, 0, 100, 1);
    const r5 = buildReferenceRingPoints(0, 0, 100, 5);
    const [x1, y1] = r1.trim().split(" ")[0].split(",").map(Number);
    const [x5, y5] = r5.trim().split(" ")[0].split(",").map(Number);
    // The rank-1 top point should be 1/5 the distance from center as rank-5 top point
    expect(Math.abs(y1)).toBeCloseTo(Math.abs(y5) / 5, 1);
    expect(Math.abs(x1)).toBeCloseTo(Math.abs(x5) / 5, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getMentalSkillSummary
// ─────────────────────────────────────────────────────────────────────────────

describe("getMentalSkillSummary", () => {
  it("all undiscovered when player has no mental skills", () => {
    const p = makePlayer({ mentalSkills: [] });
    const s = getMentalSkillSummary(p);
    expect(s.active).toBe(0);
    expect(s.dormant).toBe(0);
    expect(s.undiscovered).toBe(5);
    expect(s.totalRanks).toBe(0);
  });

  it("counts active skills correctly", () => {
    const p = makePlayer({
      mentalSkills: [
        makeSkill({ skillId: "ice_veins",         rank: 2, confidence: 80 }),
        makeSkill({ skillId: "pitch_recognition", rank: 1, confidence: 80 }),
      ],
    });
    const s = getMentalSkillSummary(p);
    expect(s.active).toBe(2);
    expect(s.dormant).toBe(0);
    expect(s.undiscovered).toBe(3);
    expect(s.totalRanks).toBe(3);
  });

  it("counts dormant skills correctly", () => {
    const p = makePlayer({
      mentalSkills: [
        makeSkill({ skillId: "ice_veins", rank: 3, confidence: CONFIDENCE_ACTIVE_THRESHOLD - 1 }),
      ],
    });
    const s = getMentalSkillSummary(p);
    expect(s.active).toBe(0);
    expect(s.dormant).toBe(1);
    expect(s.undiscovered).toBe(4);
    expect(s.totalRanks).toBe(3);
  });

  it("all 5 active with max ranks", () => {
    const p = makePlayer({
      mentalSkills: [
        makeSkill({ skillId: "ice_veins",         rank: 5, confidence: 100 }),
        makeSkill({ skillId: "pitch_recognition", rank: 5, confidence: 100 }),
        makeSkill({ skillId: "clutch_composure",  rank: 5, confidence: 100 }),
        makeSkill({ skillId: "veteran_poise",     rank: 5, confidence: 100 }),
        makeSkill({ skillId: "game_reading",      rank: 5, confidence: 100 }),
      ],
    });
    const s = getMentalSkillSummary(p);
    expect(s.active).toBe(5);
    expect(s.dormant).toBe(0);
    expect(s.undiscovered).toBe(0);
    expect(s.totalRanks).toBe(25);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPASS_AXES constant
// ─────────────────────────────────────────────────────────────────────────────

describe("COMPASS_AXES", () => {
  it("has exactly 5 axes", () => {
    expect(COMPASS_AXES).toHaveLength(5);
  });

  it("starts at -90 degrees (top of pentagon)", () => {
    expect(COMPASS_AXES[0].angleDeg).toBe(-90);
  });

  it("covers all 5 mental skill types", () => {
    const ids = COMPASS_AXES.map((a) => a.skillId);
    expect(ids).toContain("ice_veins");
    expect(ids).toContain("pitch_recognition");
    expect(ids).toContain("clutch_composure");
    expect(ids).toContain("veteran_poise");
    expect(ids).toContain("game_reading");
  });

  it("axes are spaced 72 degrees apart", () => {
    for (let i = 1; i < COMPASS_AXES.length; i++) {
      const diff = ((COMPASS_AXES[i].angleDeg - COMPASS_AXES[i - 1].angleDeg) + 360) % 360;
      expect(diff).toBeCloseTo(72, 4);
    }
  });

  it("each axis has a label and a trait", () => {
    for (const axis of COMPASS_AXES) {
      expect(axis.label.length).toBeGreaterThan(0);
      expect(axis.trait.length).toBeGreaterThan(0);
    }
  });
});
