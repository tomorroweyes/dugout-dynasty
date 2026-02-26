import { describe, it, expect } from "vitest";
import { decideBatterApproachRules, decidePitchStrategyRules } from "../decisionRulesEngine";
import type { ApproachContext } from "../../approachAI";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import { SeededRandomProvider } from "../../randomProvider";

/**
 * Validation suite for Phase 2 refactor
 *
 * Tests that new rules-based engine produces the same distribution
 * as the old nested if-else logic.
 *
 * This is the "backward compatibility" checkpoint.
 */

describe("decideBatterApproachRules - Rules Engine (Phase 2)", () => {
  describe("Backward Compatibility with Phase 1 Tests", () => {
    it("should favor contact with runner on 3rd and < 2 outs", () => {
      const context: ApproachContext = {
        outs: 0,
        bases: [false, false, true],
        myScore: 0,
        opponentScore: 1,
        inning: 5,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<BatterApproach, number> = {
        power: 0,
        contact: 0,
        patient: 0,
      };

      for (let i = 0; i < 100; i++) {
        const decision = decideBatterApproachRules(context, rng);
        results[decision]++;
      }

      // Should heavily favor contact
      expect(results.contact).toBeGreaterThan(results.power);
      expect(results.contact + results.power).toBe(100);
    });

    it("should favor power when down 4+ runs any time", () => {
      const context: ApproachContext = {
        outs: 0,
        bases: [false, false, false],
        myScore: 0,
        opponentScore: 5,
        inning: 3,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<BatterApproach, number> = {
        power: 0,
        contact: 0,
        patient: 0,
      };

      for (let i = 0; i < 100; i++) {
        const decision = decideBatterApproachRules(context, rng);
        results[decision]++;
      }

      // Should favor power
      expect(results.power).toBeGreaterThan(results.contact);
    });

    it("should follow default distribution in neutral situations", () => {
      const context: ApproachContext = {
        outs: 1,
        bases: [false, false, false],
        myScore: 2,
        opponentScore: 2,
        inning: 4,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<BatterApproach, number> = {
        power: 0,
        contact: 0,
        patient: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const decision = decideBatterApproachRules(context, rng);
        results[decision]++;
      }

      // Should approximate 45% contact, 30% power, 25% patient
      expect(results.contact).toBeGreaterThan(results.power);
      expect(results.power).toBeGreaterThan(results.patient);
    });

    it("should apply adaptation switching when repeating 2+ times", () => {
      const context: ApproachContext = {
        outs: 1,
        bases: [false, false, false],
        myScore: 2,
        opponentScore: 2,
        inning: 5,
        batterPower: 50,
        batterContact: 50,
        lastApproach: "power",
        consecutiveCount: 2,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<BatterApproach, number> = {
        power: 0,
        contact: 0,
        patient: 0,
      };

      for (let i = 0; i < 100; i++) {
        const decision = decideBatterApproachRules(context, rng);
        results[decision]++;
      }

      // Should strongly prefer switching (power should be low)
      expect(results.power).toBeLessThan(results.contact + results.patient);
    });
  });

  describe("Rule Priority (Confidence Ordering)", () => {
    it("should prefer runner-on-3rd rule (95 confidence) over defaults", () => {
      const context: ApproachContext = {
        outs: 1,
        bases: [false, false, true],
        myScore: 0,
        opponentScore: 10, // Would trigger "down 4+" if not for runner-on-3rd
        inning: 3,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const decision = decideBatterApproachRules(context, rng);

      // Runner on 3rd (contact) should win over down 10 (power)
      expect(decision).toBe("contact");
    });

    it("should prefer down-4+ rule (90 confidence) over other defaults", () => {
      const context: ApproachContext = {
        outs: 1,
        bases: [false, false, false],
        myScore: 0,
        opponentScore: 4,
        inning: 3,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const decision = decideBatterApproachRules(context, rng);

      // Down 4+ should trigger power approach
      expect(decision).toBe("power");
    });
  });
});

describe("decidePitchStrategyRules - Rules Engine (Phase 2)", () => {
  describe("Backward Compatibility with Phase 1 Tests", () => {
    it("should favor paint with bases loaded", () => {
      const context: ApproachContext = {
        outs: 1,
        bases: [true, true, true],
        myScore: 2,
        opponentScore: 1,
        inning: 5,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<PitchStrategy, number> = {
        challenge: 0,
        finesse: 0,
        paint: 0,
      };

      for (let i = 0; i < 100; i++) {
        const decision = decidePitchStrategyRules(context, rng);
        results[decision]++;
      }

      // Should favor paint
      expect(results.paint).toBeGreaterThan(results.challenge);
    });

    it("should favor finesse against high-power batter (70+)", () => {
      const context: ApproachContext = {
        outs: 0,
        bases: [false, false, false],
        myScore: 2,
        opponentScore: 2,
        inning: 5,
        batterPower: 75,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<PitchStrategy, number> = {
        challenge: 0,
        finesse: 0,
        paint: 0,
      };

      for (let i = 0; i < 100; i++) {
        const decision = decidePitchStrategyRules(context, rng);
        results[decision]++;
      }

      // Should favor finesse (high power batter rule)
      expect(results.finesse).toBeGreaterThan(results.challenge);
    });

    it("should follow default distribution in neutral situations", () => {
      const context: ApproachContext = {
        outs: 1,
        bases: [false, false, false],
        myScore: 2,
        opponentScore: 2,
        inning: 4,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const results: Record<PitchStrategy, number> = {
        challenge: 0,
        finesse: 0,
        paint: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const decision = decidePitchStrategyRules(context, rng);
        results[decision]++;
      }

      // Should approximate defaults
      expect(results.challenge).toBeGreaterThan(results.paint);
    });
  });

  describe("Rule Priority (Confidence Ordering)", () => {
    it("should prefer bases-loaded rule (95 confidence) over defaults", () => {
      const context: ApproachContext = {
        outs: 0,
        bases: [true, true, true],
        myScore: 0,
        opponentScore: 10, // Ahead = challenge, but bases loaded = paint
        inning: 3,
        batterPower: 50,
        batterContact: 50,
      };

      const rng = new SeededRandomProvider(42);
      const decision = decidePitchStrategyRules(context, rng);

      // Bases loaded (paint) should win
      expect(decision).toBe("paint");
    });
  });
});

describe("Rules Engine - Audit Trail & Decision Reasoning", () => {
  it("should make same decisions with same RNG seed", () => {
    const context: ApproachContext = {
      outs: 1,
      bases: [false, false, false],
      myScore: 2,
      opponentScore: 2,
      inning: 5,
      batterPower: 50,
      batterContact: 50,
    };

    const rng1 = new SeededRandomProvider(999);
    const rng2 = new SeededRandomProvider(999);

    const decision1 = decideBatterApproachRules(context, rng1);
    const decision2 = decideBatterApproachRules(context, rng2);

    expect(decision1).toBe(decision2);
  });
});
