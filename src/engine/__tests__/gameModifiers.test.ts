import { describe, it, expect } from "vitest";
import {
  applyPitcherFatigue,
  pitcherFatigueModifier,
  momentumModifier,
  applyModifiers,
} from "../gameModifiers";
import { GAME_CONSTANTS } from "../constants";

describe("gameModifiers", () => {

  describe("pitcherFatigueModifier", () => {
    it("should not penalize fresh pitcher", () => {
      const originalValue = 90;
      const result = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: 0,
      });
      expect(result).toBe(originalValue);
    });

    it("should apply progressive penalty as innings increase", () => {
      const originalValue = 90;

      const result1 = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: 1,
      });
      const result3 = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: 3,
      });
      const result5 = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: 5,
      });

      expect(result1).toBeLessThan(originalValue);
      expect(result3).toBeLessThan(result1);
      expect(result5).toBeLessThan(result3);
    });

    it("should apply correct percentage loss per inning", () => {
      const originalValue = 100;
      const result = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: 1,
      });

      const expectedPenalty =
        1 - GAME_CONSTANTS.PITCHER_FATIGUE.EFFECTIVENESS_LOSS_PER_INNING;
      expect(result).toBe(originalValue * expectedPenalty);
    });

    it("should not drop below minimum effectiveness", () => {
      const originalValue = 100;
      const result = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: 20, // Extreme fatigue
      });

      const minValue =
        originalValue * GAME_CONSTANTS.PITCHER_FATIGUE.MINIMUM_EFFECTIVENESS;
      expect(result).toBe(minValue);
      expect(result).toBeGreaterThan(0);
    });

    it("should reach minimum effectiveness at expected innings", () => {
      const originalValue = 100;
      // Calculate innings needed to reach minimum
      const inningsToMin =
        (1 - GAME_CONSTANTS.PITCHER_FATIGUE.MINIMUM_EFFECTIVENESS) /
        GAME_CONSTANTS.PITCHER_FATIGUE.EFFECTIVENESS_LOSS_PER_INNING;

      const result = pitcherFatigueModifier.apply(originalValue, {
        inningsPitched: inningsToMin,
      });

      expect(result).toBe(
        originalValue * GAME_CONSTANTS.PITCHER_FATIGUE.MINIMUM_EFFECTIVENESS
      );
    });

    it("should handle undefined innings pitched", () => {
      const originalValue = 90;
      const result = pitcherFatigueModifier.apply(originalValue, {});
      expect(result).toBe(originalValue);
    });
  });

  describe("momentumModifier", () => {
    it("should not modify with neutral momentum", () => {
      const originalValue = 80;
      const result = momentumModifier.apply(originalValue, { momentum: 0 });
      expect(result).toBe(originalValue);
    });

    it("should boost with positive momentum", () => {
      const originalValue = 80;
      const result = momentumModifier.apply(originalValue, { momentum: 1 });
      expect(result).toBeGreaterThan(originalValue);
      expect(result).toBe(originalValue * 1.1); // +10%
    });

    it("should penalize with negative momentum", () => {
      const originalValue = 80;
      const result = momentumModifier.apply(originalValue, { momentum: -1 });
      expect(result).toBeLessThan(originalValue);
      expect(result).toBe(originalValue * 0.9); // -10%
    });

    it("should scale momentum effect correctly", () => {
      const originalValue = 100;

      const result05 = momentumModifier.apply(originalValue, { momentum: 0.5 });
      const result1 = momentumModifier.apply(originalValue, { momentum: 1 });

      expect(result05).toBeCloseTo(105, 1); // +5%
      expect(result1).toBeCloseTo(110, 1); // +10%
    });

    it("should handle undefined momentum", () => {
      const originalValue = 80;
      const result = momentumModifier.apply(originalValue, {});
      expect(result).toBe(originalValue);
    });
  });

  describe("applyPitcherFatigue", () => {
    it("should be a convenience wrapper for fatigue modifier", () => {
      const value = 80;
      const innings = 5;

      const result = applyPitcherFatigue(value, innings);
      const expected = pitcherFatigueModifier.apply(value, {
        inningsPitched: innings,
      });

      expect(result).toBe(expected);
    });
  });

  describe("applyModifiers", () => {
    it("should apply multiple modifiers in sequence", () => {
      const originalValue = 100;
      const context = {
        inningsPitched: 3,
        momentum: 0.5,
      };

      const result = applyModifiers(originalValue, context, [
        pitcherFatigueModifier,
        momentumModifier,
      ]);

      // Calculate expected value step by step
      let expected = originalValue;
      expected = pitcherFatigueModifier.apply(expected, context);
      expected = momentumModifier.apply(expected, context);

      expect(result).toBe(expected);
    });

    it("should handle empty modifier array", () => {
      const originalValue = 100;
      const result = applyModifiers(originalValue, {}, []);

      expect(result).toBe(originalValue);
    });
  });

  describe("integration tests", () => {
    it("should model realistic pitcher degradation over game", () => {
      const baseVelocity = 90;

      // Track velocity over 9 innings
      const velocityByInning: number[] = [];

      for (let inning = 0; inning <= 9; inning++) {
        const velocity = applyPitcherFatigue(baseVelocity, inning);
        velocityByInning.push(velocity);
      }

      // Velocity should steadily decrease
      for (let i = 1; i < velocityByInning.length; i++) {
        expect(velocityByInning[i]).toBeLessThanOrEqual(
          velocityByInning[i - 1]
        );
      }

      // Should lose approximately 8% per inning (updated from 5% for more meaningful fatigue)
      expect(velocityByInning[1]).toBeCloseTo(baseVelocity * 0.92, 1);
      expect(velocityByInning[5]).toBeCloseTo(baseVelocity * 0.60, 1);
    });
  });
});
