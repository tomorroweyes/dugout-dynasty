import { describe, it, expect } from "vitest";
import { calculateRosterGap, generateDraftSlots } from "../rosterDraft";
import { generateStarterTeam } from "../playerGenerator";
import { SeededRandomProvider } from "../randomProvider";
import { Player } from "@/types/game";

describe("rosterDraft", () => {
  describe("calculateRosterGap", () => {
    it("should calculate gap from SANDLOT to LOCAL", () => {
      const rng = new SeededRandomProvider(42);
      const roster = generateStarterTeam(rng, "SANDLOT");

      const gap = calculateRosterGap(roster, "LOCAL");

      // SANDLOT: 4B, 1S, 0R → LOCAL: 4B, 1S, 1R
      expect(gap.battersNeeded).toBe(0);
      expect(gap.startersNeeded).toBe(0);
      expect(gap.relieversNeeded).toBe(1);
      expect(gap.totalNeeded).toBe(1);
    });

    it("should calculate gap from SANDLOT to REGIONAL", () => {
      const rng = new SeededRandomProvider(42);
      const roster = generateStarterTeam(rng, "SANDLOT");

      const gap = calculateRosterGap(roster, "REGIONAL");

      // SANDLOT: 4B, 1S, 0R → REGIONAL: 6B, 2S, 1R
      expect(gap.battersNeeded).toBe(2);
      expect(gap.startersNeeded).toBe(1);
      expect(gap.relieversNeeded).toBe(1);
      expect(gap.totalNeeded).toBe(4);
    });

    it("should return zero gap for same tier", () => {
      const rng = new SeededRandomProvider(42);
      const roster = generateStarterTeam(rng, "LOCAL");

      const gap = calculateRosterGap(roster, "LOCAL");

      expect(gap.totalNeeded).toBe(0);
    });

    it("should return zero gap when demoting", () => {
      const rng = new SeededRandomProvider(42);
      const roster = generateStarterTeam(rng, "REGIONAL");

      // REGIONAL roster (6B, 2S, 1R) going to LOCAL (4B, 1S, 1R) — already has enough
      const gap = calculateRosterGap(roster, "LOCAL");

      expect(gap.totalNeeded).toBe(0);
    });

    it("should handle roster with extra players from previous tiers", () => {
      const rng = new SeededRandomProvider(42);
      // Start with LOCAL roster (4B, 1S, 1R), promote to REGIONAL (6B, 2S, 1R)
      const roster = generateStarterTeam(rng, "LOCAL");

      const gap = calculateRosterGap(roster, "REGIONAL");

      expect(gap.battersNeeded).toBe(2);
      expect(gap.startersNeeded).toBe(1);
      expect(gap.relieversNeeded).toBe(0);
      expect(gap.totalNeeded).toBe(3);
    });
  });

  describe("generateDraftSlots", () => {
    it("should generate correct number of slots", () => {
      const rng = new SeededRandomProvider(42);
      const gap = {
        battersNeeded: 1,
        startersNeeded: 0,
        relieversNeeded: 1,
        totalNeeded: 2,
      };

      const slots = generateDraftSlots(gap, "LOCAL", rng);

      expect(slots).toHaveLength(2);
    });

    it("should generate 3 candidates per slot", () => {
      const rng = new SeededRandomProvider(42);
      const gap = {
        battersNeeded: 1,
        startersNeeded: 0,
        relieversNeeded: 1,
        totalNeeded: 2,
      };

      const slots = generateDraftSlots(gap, "LOCAL", rng);

      for (const slot of slots) {
        expect(slot.candidates).toHaveLength(3);
      }
    });

    it("should assign correct roles to slots", () => {
      const rng = new SeededRandomProvider(42);
      const gap = {
        battersNeeded: 2,
        startersNeeded: 1,
        relieversNeeded: 1,
        totalNeeded: 4,
      };

      const slots = generateDraftSlots(gap, "REGIONAL", rng);

      expect(slots[0].role).toBe("Batter");
      expect(slots[1].role).toBe("Batter");
      expect(slots[2].role).toBe("Starter");
      expect(slots[3].role).toBe("Reliever");
    });

    it("should generate candidates matching slot role", () => {
      const rng = new SeededRandomProvider(42);
      const gap = {
        battersNeeded: 1,
        startersNeeded: 1,
        relieversNeeded: 0,
        totalNeeded: 2,
      };

      const slots = generateDraftSlots(gap, "REGIONAL", rng);

      for (const slot of slots) {
        for (const candidate of slot.candidates) {
          expect(candidate.role).toBe(slot.role);
        }
      }
    });

    it("should generate unique player IDs", () => {
      const rng = new SeededRandomProvider(42);
      const gap = {
        battersNeeded: 3,
        startersNeeded: 1,
        relieversNeeded: 1,
        totalNeeded: 5,
      };

      const slots = generateDraftSlots(gap, "NATIONAL", rng);
      const allIds = slots.flatMap((s) => s.candidates.map((c) => c.id));
      const uniqueIds = new Set(allIds);

      expect(uniqueIds.size).toBe(allIds.length);
    });

    it("should return empty array when no slots needed", () => {
      const rng = new SeededRandomProvider(42);
      const gap = {
        battersNeeded: 0,
        startersNeeded: 0,
        relieversNeeded: 0,
        totalNeeded: 0,
      };

      const slots = generateDraftSlots(gap, "SANDLOT", rng);

      expect(slots).toHaveLength(0);
    });
  });
});
