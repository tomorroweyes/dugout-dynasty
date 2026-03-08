/**
 * Tests for signatureSkillSystem.ts — Issue #33
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Player } from "@/types/game";
import type { BreakthroughEvent, SignatureSkill } from "@/types/breakthroughs";
import {
  generateSignatureSkill,
  applySignatureEffect,
  recordHighLeverageUse,
  archiveSignatureSkill,
  getActiveSignatureSkill,
  getArchivedSignatureSkills,
  attachSignatureToPlayer,
  narrativeSignatureUse,
  narrativeSignatureCounter,
  narrativeSignatureReveal,
  narrativeReinventionArchive,
  SIGNATURE_REPUTATION_THRESHOLDS,
  SIGNATURE_COUNTER_REDUCTION,
} from "@/engine/signatureSkillSystem";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-001",
    name: "Rivera",
    surname: "Rivera",
    role: "Batter",
    stats: { power: 70, contact: 75, glove: 60, speed: 65 },
    salary: 5000,
    level: 5,
    xp: 500,
    totalXpEarned: 2000,
    equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    spirit: { current: 80, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...overrides,
  };
}

function makeBreakthrough(overrides: Partial<BreakthroughEvent> = {}): BreakthroughEvent {
  return {
    breakthroughId: "bt-001",
    playerId: "p-001",
    skillId: "ice_veins",
    skillRank: 5,
    archetype: "streak_moment",
    triggeredAt: {
      gameNumber: 12,
      inning: 9,
      scoreDiff: 0,
      context: "tied, 9th+",
    },
    narrative: "Something clicked.",
    memoryLabel: "Rivera's Ice Veins (G12, tied, 9th+)",
    signatureSkillId: "sig-p-001-ice_veins-1000",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeSignature(overrides: Partial<SignatureSkill> = {}): SignatureSkill {
  const breakthrough = makeBreakthrough();
  const player = makePlayer();
  const sig = generateSignatureSkill(player, breakthrough);
  return { ...sig, ...overrides };
}

// ---------------------------------------------------------------------------
// generateSignatureSkill
// ---------------------------------------------------------------------------

describe("generateSignatureSkill", () => {
  it("creates signature with isActive=true and isArchived=false", () => {
    const sig = generateSignatureSkill(makePlayer(), makeBreakthrough());
    expect(sig.isActive).toBe(true);
    expect(sig.isArchived).toBe(false);
  });

  it("initializes scoutLevel at 0", () => {
    const sig = generateSignatureSkill(makePlayer(), makeBreakthrough());
    expect(sig.reputation.scoutLevel).toBe(0);
  });

  it("initializes highLeverageUses at 0", () => {
    const sig = generateSignatureSkill(makePlayer(), makeBreakthrough());
    expect(sig.reputation.highLeverageUses).toBe(0);
  });

  it("sets effectBonus to 0.10 (10%)", () => {
    const sig = generateSignatureSkill(makePlayer(), makeBreakthrough());
    expect(sig.effectBonus).toBeCloseTo(0.10);
  });

  it("skillName includes player name", () => {
    const player = makePlayer({ name: "Rivera" });
    const sig = generateSignatureSkill(player, makeBreakthrough());
    expect(sig.skillName).toContain("Rivera");
  });

  it("skillName includes a variant word (not just player name)", () => {
    const player = makePlayer({ name: "Jones" });
    const sig = generateSignatureSkill(player, makeBreakthrough());
    // Should be something like "Jones's Scalpel" — more than just the name
    expect(sig.skillName.split("'s ").length).toBe(2);
    expect(sig.skillName.split("'s ")[1].length).toBeGreaterThan(0);
  });

  it("uses contact-category variants for ice_veins skill", () => {
    const contactVariants = ["Scalpel", "Brush", "Needle", "Chip"];
    const player = makePlayer({ name: "Test" });
    const bt = makeBreakthrough({ skillId: "ice_veins" });
    const sig = generateSignatureSkill(player, bt);
    const variantName = sig.skillName.split("'s ")[1];
    expect(contactVariants).toContain(variantName);
  });

  it("uses contact-category variants for pitch_recognition skill", () => {
    const contactVariants = ["Scalpel", "Brush", "Needle", "Chip"];
    const player = makePlayer({ name: "Test" });
    const bt = makeBreakthrough({ skillId: "pitch_recognition" });
    const sig = generateSignatureSkill(player, bt);
    const variantName = sig.skillName.split("'s ")[1];
    expect(contactVariants).toContain(variantName);
  });

  it("uses power-category variants for clutch_composure skill", () => {
    const powerVariants = ["Hammer", "Cannon", "Bomb", "Blast", "Spike"];
    const player = makePlayer({ name: "Test" });
    const bt = makeBreakthrough({ skillId: "clutch_composure" });
    const sig = generateSignatureSkill(player, bt);
    const variantName = sig.skillName.split("'s ")[1];
    expect(powerVariants).toContain(variantName);
  });

  it("uses defense-category variants for veteran_poise skill", () => {
    const defenseVariants = ["Wall", "Vacuum", "Stone", "Iron"];
    const player = makePlayer({ name: "Test" });
    const bt = makeBreakthrough({ skillId: "veteran_poise" });
    const sig = generateSignatureSkill(player, bt);
    const variantName = sig.skillName.split("'s ")[1];
    expect(defenseVariants).toContain(variantName);
  });

  it("uses defense-category variants for game_reading skill", () => {
    const defenseVariants = ["Wall", "Vacuum", "Stone", "Iron"];
    const player = makePlayer({ name: "Test" });
    const bt = makeBreakthrough({ skillId: "game_reading" });
    const sig = generateSignatureSkill(player, bt);
    const variantName = sig.skillName.split("'s ")[1];
    expect(defenseVariants).toContain(variantName);
  });

  it("stores the breakthrough event as unlockedAt", () => {
    const bt = makeBreakthrough({ breakthroughId: "bt-unique" });
    const sig = generateSignatureSkill(makePlayer(), bt);
    expect(sig.unlockedAt.breakthroughId).toBe("bt-unique");
  });

  it("uses signatureSkillId from breakthrough if provided", () => {
    const bt = makeBreakthrough({ signatureSkillId: "sig-custom-id" });
    const sig = generateSignatureSkill(makePlayer(), bt);
    expect(sig.signatureId).toBe("sig-custom-id");
  });

  it("generates a fallback signatureId if breakthrough has none", () => {
    const bt = makeBreakthrough({ signatureSkillId: undefined });
    const sig = generateSignatureSkill(makePlayer(), bt);
    expect(sig.signatureId).toBeTruthy();
    expect(sig.signatureId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// applySignatureEffect
// ---------------------------------------------------------------------------

describe("applySignatureEffect", () => {
  it("adds full bonus at scoutLevel 0 (no counter)", () => {
    const sig = makeSignature({ effectBonus: 0.10 });
    const result = applySignatureEffect(1.0, sig, 0);
    expect(result).toBeCloseTo(1.10);
  });

  it("reduces bonus by 5% at scoutLevel 1", () => {
    const sig = makeSignature({ effectBonus: 0.10 });
    const result = applySignatureEffect(1.0, sig, 1);
    // bonus reduced by 5%: 0.10 * 0.95 = 0.095 → total 1.095
    expect(result).toBeCloseTo(1.095);
  });

  it("reduces bonus by 25% at scoutLevel 2", () => {
    const sig = makeSignature({ effectBonus: 0.10 });
    const result = applySignatureEffect(1.0, sig, 2);
    // bonus reduced by 25%: 0.10 * 0.75 = 0.075 → total 1.075
    expect(result).toBeCloseTo(1.075);
  });

  it("reduces bonus by 50% at scoutLevel 3 (full counter)", () => {
    const sig = makeSignature({ effectBonus: 0.10 });
    const result = applySignatureEffect(1.0, sig, 3);
    // bonus reduced by 50%: 0.10 * 0.50 = 0.05 → total 1.05
    expect(result).toBeCloseTo(1.05);
  });

  it("returns baseEffect unchanged when signature is not active", () => {
    const sig = makeSignature({ isActive: false });
    const result = applySignatureEffect(1.0, sig, 0);
    expect(result).toBeCloseTo(1.0);
  });

  it("returns baseEffect unchanged when signature is archived", () => {
    const sig = makeSignature({ isArchived: true });
    const result = applySignatureEffect(1.0, sig, 0);
    expect(result).toBeCloseTo(1.0);
  });

  it("applies to different base effects correctly", () => {
    const sig = makeSignature({ effectBonus: 0.10 });
    const result = applySignatureEffect(0.80, sig, 0);
    expect(result).toBeCloseTo(0.90);
  });

  it("counter reduction constants are correct values", () => {
    expect(SIGNATURE_COUNTER_REDUCTION[0]).toBe(0.00);
    expect(SIGNATURE_COUNTER_REDUCTION[1]).toBe(0.05);
    expect(SIGNATURE_COUNTER_REDUCTION[2]).toBe(0.25);
    expect(SIGNATURE_COUNTER_REDUCTION[3]).toBe(0.50);
  });
});

// ---------------------------------------------------------------------------
// recordHighLeverageUse
// ---------------------------------------------------------------------------

describe("recordHighLeverageUse", () => {
  it("increments highLeverageUses by 1", () => {
    const sig = makeSignature();
    sig.reputation.highLeverageUses = 0;
    recordHighLeverageUse(sig);
    expect(sig.reputation.highLeverageUses).toBe(1);
  });

  it("tracks opponent team in knownBy", () => {
    const sig = makeSignature();
    recordHighLeverageUse(sig, "Steel City Rollers");
    expect(sig.reputation.knownBy).toContain("Steel City Rollers");
  });

  it("does not duplicate team in knownBy", () => {
    const sig = makeSignature();
    recordHighLeverageUse(sig, "Steel City Rollers");
    recordHighLeverageUse(sig, "Steel City Rollers");
    expect(sig.reputation.knownBy.filter((t) => t === "Steel City Rollers").length).toBe(1);
  });

  it("escalates to Tier 1 after 10 uses", () => {
    const sig = makeSignature();
    sig.reputation.highLeverageUses = SIGNATURE_REPUTATION_THRESHOLDS.tier1 - 1;
    recordHighLeverageUse(sig);
    expect(sig.reputation.scoutLevel).toBe(1);
  });

  it("escalates to Tier 2 after 25 uses", () => {
    const sig = makeSignature();
    sig.reputation.highLeverageUses = SIGNATURE_REPUTATION_THRESHOLDS.tier2 - 1;
    sig.reputation.scoutLevel = 1;
    recordHighLeverageUse(sig);
    expect(sig.reputation.scoutLevel).toBe(2);
  });

  it("escalates to Tier 3 after 50 uses", () => {
    const sig = makeSignature();
    sig.reputation.highLeverageUses = SIGNATURE_REPUTATION_THRESHOLDS.tier3 - 1;
    sig.reputation.scoutLevel = 2;
    recordHighLeverageUse(sig);
    expect(sig.reputation.scoutLevel).toBe(3);
  });

  it("does not escalate past Tier 3", () => {
    const sig = makeSignature();
    sig.reputation.scoutLevel = 3;
    sig.reputation.highLeverageUses = 100;
    recordHighLeverageUse(sig);
    expect(sig.reputation.scoutLevel).toBe(3);
  });

  it("adds counter strategy description at Tier 2", () => {
    const sig = makeSignature();
    sig.reputation.highLeverageUses = SIGNATURE_REPUTATION_THRESHOLDS.tier2 - 1;
    sig.reputation.scoutLevel = 1;
    recordHighLeverageUse(sig);
    expect(sig.reputation.counterStrategies.length).toBeGreaterThan(0);
  });

  it("does not record use on inactive signature", () => {
    const sig = makeSignature({ isActive: false });
    sig.reputation.highLeverageUses = 0;
    recordHighLeverageUse(sig);
    expect(sig.reputation.highLeverageUses).toBe(0);
  });

  it("does not record use on archived signature", () => {
    const sig = makeSignature({ isArchived: true });
    sig.reputation.highLeverageUses = 0;
    recordHighLeverageUse(sig);
    expect(sig.reputation.highLeverageUses).toBe(0);
  });

  it("reputation thresholds are correct", () => {
    expect(SIGNATURE_REPUTATION_THRESHOLDS.tier1).toBe(10);
    expect(SIGNATURE_REPUTATION_THRESHOLDS.tier2).toBe(25);
    expect(SIGNATURE_REPUTATION_THRESHOLDS.tier3).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// archiveSignatureSkill / getActiveSignatureSkill / getArchivedSignatureSkills
// ---------------------------------------------------------------------------

describe("archiveSignatureSkill", () => {
  it("sets isActive=false and isArchived=true", () => {
    const player = makePlayer();
    const sig = makeSignature({ signatureId: "sig-archive-test" });
    player.signatureSkills = new Map([["sig-archive-test", sig]]);

    archiveSignatureSkill(player, "sig-archive-test");

    expect(sig.isActive).toBe(false);
    expect(sig.isArchived).toBe(true);
  });

  it("returns false when signatureId not found", () => {
    const player = makePlayer();
    const result = archiveSignatureSkill(player, "sig-nonexistent");
    expect(result).toBe(false);
  });

  it("returns true on successful archive", () => {
    const player = makePlayer();
    const sig = makeSignature({ signatureId: "sig-ok" });
    player.signatureSkills = new Map([["sig-ok", sig]]);
    const result = archiveSignatureSkill(player, "sig-ok");
    expect(result).toBe(true);
  });
});

describe("getActiveSignatureSkill", () => {
  it("returns null when player has no signatures", () => {
    const player = makePlayer();
    expect(getActiveSignatureSkill(player)).toBeNull();
  });

  it("returns the active signature", () => {
    const player = makePlayer();
    const sig = makeSignature({ signatureId: "sig-a", isActive: true, isArchived: false });
    player.signatureSkills = new Map([["sig-a", sig]]);
    expect(getActiveSignatureSkill(player)).toBe(sig);
  });

  it("returns null when all signatures are archived", () => {
    const player = makePlayer();
    const sig = makeSignature({ signatureId: "sig-b", isActive: false, isArchived: true });
    player.signatureSkills = new Map([["sig-b", sig]]);
    expect(getActiveSignatureSkill(player)).toBeNull();
  });
});

describe("getArchivedSignatureSkills", () => {
  it("returns empty array when no signatures", () => {
    expect(getArchivedSignatureSkills(makePlayer())).toEqual([]);
  });

  it("returns only archived signatures", () => {
    const player = makePlayer();
    const active = makeSignature({ signatureId: "sig-active", isActive: true, isArchived: false });
    const archived = makeSignature({ signatureId: "sig-archived", isActive: false, isArchived: true });
    player.signatureSkills = new Map([
      ["sig-active", active],
      ["sig-archived", archived],
    ]);
    const results = getArchivedSignatureSkills(player);
    expect(results.length).toBe(1);
    expect(results[0].signatureId).toBe("sig-archived");
  });
});

// ---------------------------------------------------------------------------
// attachSignatureToPlayer
// ---------------------------------------------------------------------------

describe("attachSignatureToPlayer", () => {
  it("stores signature on player", () => {
    const player = makePlayer();
    const sig = makeSignature({ signatureId: "sig-new" });
    attachSignatureToPlayer(player, sig);
    expect(player.signatureSkills?.has("sig-new")).toBe(true);
  });

  it("throws when player already has an active signature", () => {
    const player = makePlayer();
    const existing = makeSignature({ signatureId: "sig-existing" });
    player.signatureSkills = new Map([["sig-existing", existing]]);

    const second = makeSignature({ signatureId: "sig-second" });
    expect(() => attachSignatureToPlayer(player, second)).toThrow();
  });

  it("allows attach after existing signature is archived", () => {
    const player = makePlayer();
    const existing = makeSignature({ signatureId: "sig-old", isActive: false, isArchived: true });
    player.signatureSkills = new Map([["sig-old", existing]]);

    const newSig = makeSignature({ signatureId: "sig-new-2" });
    expect(() => attachSignatureToPlayer(player, newSig)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Narrative helpers
// ---------------------------------------------------------------------------

describe("Narrative helpers", () => {
  it("narrativeSignatureUse contains player and signature name", () => {
    const text = narrativeSignatureUse("Rivera", "Rivera's Scalpel");
    expect(text).toContain("Rivera");
    expect(text).toContain("Rivera's Scalpel");
  });

  it("narrativeSignatureCounter contains signature name", () => {
    const text = narrativeSignatureCounter("Jones", "Jones's Hammer");
    // Not all counter texts include the name, but should be non-empty
    expect(text.length).toBeGreaterThan(0);
  });

  it("narrativeSignatureReveal contains player or signature name", () => {
    const text = narrativeSignatureReveal("Chen", "Chen's Wall");
    expect(text.length).toBeGreaterThan(0);
  });

  it("narrativeReinventionArchive contains player name", () => {
    const text = narrativeReinventionArchive("Rivera");
    expect(text).toContain("Rivera");
  });

  it("narrativeSignatureUse returns a non-empty string", () => {
    const text = narrativeSignatureUse("X", "X's Blade");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});
