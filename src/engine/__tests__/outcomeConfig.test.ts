import { describe, it, expect } from "vitest";
import {
  OUTCOME_CONFIG,
  applyOutcome,
  getOutcomeDisplayText,
} from "../outcomeConfig";

describe("outcomeConfig", () => {
  describe("BaseAdvancementRules", () => {
    describe("none/out advancement", () => {
      it("should keep bases unchanged for outs", () => {
        const bases: [boolean, boolean, boolean] = [true, true, true];
        const config = OUTCOME_CONFIG.groundout;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, true, true]);
      });

      it("should handle empty bases for outs", () => {
        const bases: [boolean, boolean, boolean] = [false, false, false];
        const config = OUTCOME_CONFIG.flyout;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([false, false, false]);
      });
    });

    describe("walk advancement", () => {
      it("should force runner from first with bases empty", () => {
        const bases: [boolean, boolean, boolean] = [false, false, false];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, false, false]);
      });

      it("should force runners with man on first only", () => {
        const bases: [boolean, boolean, boolean] = [true, false, false];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, true, false]);
      });

      it("should force runners with first and second occupied", () => {
        const bases: [boolean, boolean, boolean] = [true, true, false];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, true, true]);
      });

      it("should score run with bases loaded", () => {
        const bases: [boolean, boolean, boolean] = [true, true, true];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([true, true, true]);
      });

      it("should not force runner on second if first is empty", () => {
        const bases: [boolean, boolean, boolean] = [false, true, false];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, true, false]);
      });

      it("should not force runner on third if first and second are empty", () => {
        const bases: [boolean, boolean, boolean] = [false, false, true];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, false, true]);
      });

      it("should handle second and third occupied", () => {
        const bases: [boolean, boolean, boolean] = [false, true, true];
        const config = OUTCOME_CONFIG.walk;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, true, true]);
      });
    });

    describe("single advancement", () => {
      it("should put batter on first with bases empty", () => {
        const bases: [boolean, boolean, boolean] = [false, false, false];
        const config = OUTCOME_CONFIG.single;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, false, false]);
      });

      it("should advance runner from first to second", () => {
        const bases: [boolean, boolean, boolean] = [true, false, false];
        const config = OUTCOME_CONFIG.single;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, true, false]);
      });

      it("should advance runner from second to third", () => {
        const bases: [boolean, boolean, boolean] = [false, true, false];
        const config = OUTCOME_CONFIG.single;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([true, false, true]);
      });

      it("should score runner from third", () => {
        const bases: [boolean, boolean, boolean] = [false, false, true];
        const config = OUTCOME_CONFIG.single;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([true, false, false]);
      });

      it("should handle first and third", () => {
        const bases: [boolean, boolean, boolean] = [true, false, true];
        const config = OUTCOME_CONFIG.single;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([true, true, false]);
      });

      it("should handle bases loaded", () => {
        const bases: [boolean, boolean, boolean] = [true, true, true];
        const config = OUTCOME_CONFIG.single;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([true, true, true]);
      });
    });

    describe("double advancement", () => {
      it("should put batter on second with bases empty", () => {
        const bases: [boolean, boolean, boolean] = [false, false, false];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([false, true, false]);
      });

      it("should advance runner from first to third", () => {
        const bases: [boolean, boolean, boolean] = [true, false, false];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([false, true, true]);
      });

      it("should score runner from second", () => {
        const bases: [boolean, boolean, boolean] = [false, true, false];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, true, false]);
      });

      it("should score runner from third", () => {
        const bases: [boolean, boolean, boolean] = [false, false, true];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, true, false]);
      });

      it("should score both runners from second and third", () => {
        const bases: [boolean, boolean, boolean] = [false, true, true];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(2);
        expect(result.newBases).toEqual([false, true, false]);
      });

      it("should score one from third, advance first to third", () => {
        const bases: [boolean, boolean, boolean] = [true, false, true];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, true, true]);
      });

      it("should score two with bases loaded", () => {
        const bases: [boolean, boolean, boolean] = [true, true, true];
        const config = OUTCOME_CONFIG.double;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(2);
        expect(result.newBases).toEqual([false, true, true]);
      });
    });

    describe("triple advancement", () => {
      it("should put batter on third with bases empty", () => {
        const bases: [boolean, boolean, boolean] = [false, false, false];
        const config = OUTCOME_CONFIG.triple;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(0);
        expect(result.newBases).toEqual([false, false, true]);
      });

      it("should score one runner with man on first", () => {
        const bases: [boolean, boolean, boolean] = [true, false, false];
        const config = OUTCOME_CONFIG.triple;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, false, true]);
      });

      it("should score one runner with man on second", () => {
        const bases: [boolean, boolean, boolean] = [false, true, false];
        const config = OUTCOME_CONFIG.triple;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, false, true]);
      });

      it("should score one runner with man on third", () => {
        const bases: [boolean, boolean, boolean] = [false, false, true];
        const config = OUTCOME_CONFIG.triple;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, false, true]);
      });

      it("should score two runners with first and second", () => {
        const bases: [boolean, boolean, boolean] = [true, true, false];
        const config = OUTCOME_CONFIG.triple;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(2);
        expect(result.newBases).toEqual([false, false, true]);
      });

      it("should score all three runners with bases loaded", () => {
        const bases: [boolean, boolean, boolean] = [true, true, true];
        const config = OUTCOME_CONFIG.triple;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(3);
        expect(result.newBases).toEqual([false, false, true]);
      });
    });

    describe("homerun advancement", () => {
      it("should clear bases and score batter (solo)", () => {
        const bases: [boolean, boolean, boolean] = [false, false, false];
        const config = OUTCOME_CONFIG.homerun;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, false, false]);
      });

      it("should score two with man on first (2-run homer)", () => {
        const bases: [boolean, boolean, boolean] = [true, false, false];
        const config = OUTCOME_CONFIG.homerun;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(2);
        expect(result.newBases).toEqual([false, false, false]);
      });

      it("should score three with men on first and second", () => {
        const bases: [boolean, boolean, boolean] = [true, true, false];
        const config = OUTCOME_CONFIG.homerun;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(3);
        expect(result.newBases).toEqual([false, false, false]);
      });

      it("should score four with bases loaded (grand slam)", () => {
        const bases: [boolean, boolean, boolean] = [true, true, true];
        const config = OUTCOME_CONFIG.homerun;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(4);
        expect(result.newBases).toEqual([false, false, false]);
      });

      it("should handle scattered runners (first and third)", () => {
        const bases: [boolean, boolean, boolean] = [true, false, true];
        const config = OUTCOME_CONFIG.homerun;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(3);
        expect(result.newBases).toEqual([false, false, false]);
      });

      it("should handle man on third only", () => {
        const bases: [boolean, boolean, boolean] = [false, false, true];
        const config = OUTCOME_CONFIG.homerun;
        const result = config.advanceBases(bases);

        expect(result.runsScored).toBe(2);
        expect(result.newBases).toEqual([false, false, false]);
      });
    });
  });

  describe("OUTCOME_CONFIG", () => {
    describe("strikeout", () => {
      it("should have correct configuration", () => {
        const config = OUTCOME_CONFIG.strikeout;

        expect(config.countsAsAtBat).toBe(true);
        expect(config.isHit).toBe(false);
        expect(config.isOut).toBe(true);
        expect(config.isStrikeout).toBe(true);
        expect(config.isWalk).toBe(false);
        expect(config.batterReachesBase).toBeUndefined();
      });
    });

    describe("walk", () => {
      it("should have correct configuration", () => {
        const config = OUTCOME_CONFIG.walk;

        expect(config.countsAsAtBat).toBe(false);
        expect(config.isHit).toBe(false);
        expect(config.isOut).toBe(false);
        expect(config.isStrikeout).toBe(false);
        expect(config.isWalk).toBe(true);
        expect(config.batterReachesBase).toBe(1);
      });
    });

    describe("hits", () => {
      it("should configure single correctly", () => {
        const config = OUTCOME_CONFIG.single;

        expect(config.countsAsAtBat).toBe(true);
        expect(config.isHit).toBe(true);
        expect(config.isOut).toBe(false);
        expect(config.batterReachesBase).toBe(1);
      });

      it("should configure double correctly", () => {
        const config = OUTCOME_CONFIG.double;

        expect(config.countsAsAtBat).toBe(true);
        expect(config.isHit).toBe(true);
        expect(config.isOut).toBe(false);
        expect(config.batterReachesBase).toBe(2);
      });

      it("should configure triple correctly", () => {
        const config = OUTCOME_CONFIG.triple;

        expect(config.countsAsAtBat).toBe(true);
        expect(config.isHit).toBe(true);
        expect(config.isOut).toBe(false);
        expect(config.batterReachesBase).toBe(3);
      });

      it("should configure homerun correctly", () => {
        const config = OUTCOME_CONFIG.homerun;

        expect(config.countsAsAtBat).toBe(true);
        expect(config.isHit).toBe(true);
        expect(config.isOut).toBe(false);
        expect(config.batterReachesBase).toBe(4);
      });
    });

    describe("outs", () => {
      const outTypes = ["groundout", "flyout", "lineout", "popout"] as const;

      outTypes.forEach((outType) => {
        it(`should configure ${outType} correctly`, () => {
          const config = OUTCOME_CONFIG[outType];

          expect(config.countsAsAtBat).toBe(true);
          expect(config.isHit).toBe(false);
          expect(config.isOut).toBe(true);
          expect(config.isStrikeout).toBe(false);
          expect(config.isWalk).toBe(false);
          expect(config.batterReachesBase).toBeUndefined();
        });
      });
    });

    describe("display text", () => {
      it("should have display text for all outcomes", () => {
        const outcomes = [
          "strikeout",
          "walk",
          "single",
          "double",
          "triple",
          "homerun",
          "groundout",
          "flyout",
          "lineout",
          "popout",
        ] as const;

        outcomes.forEach((outcome) => {
          const config = OUTCOME_CONFIG[outcome];
          expect(config.displayText).toBeTruthy();
          expect(typeof config.displayText).toBe("string");
        });
      });

      it("should have display variants for variety", () => {
        const outcomes = [
          "strikeout",
          "walk",
          "single",
          "double",
          "triple",
          "homerun",
        ] as const;

        outcomes.forEach((outcome) => {
          const config = OUTCOME_CONFIG[outcome];
          expect(config.displayVariants).toBeDefined();
          expect(Array.isArray(config.displayVariants)).toBe(true);
          expect(config.displayVariants!.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("applyOutcome", () => {
    const createEmptyStats = () => ({
      hits: 0,
      abs: 0,
      strikeouts: 0,
      walks: 0,
      runs: 0,
      rbis: 0,
    });

    const createEmptyPitcherStats = () => ({
      hitsAllowed: 0,
      runsAllowed: 0,
      strikeouts: 0,
      walks: 0,
    });

    describe("batter stats updates", () => {
      it("should increment at-bats for outcomes that count", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.abs).toBe(1);
      });

      it("should not increment at-bats for walks", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "walk",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.abs).toBe(0);
        expect(result.batterStats.walks).toBe(1);
      });

      it("should increment hits for singles", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.hits).toBe(1);
        expect(result.batterStats.abs).toBe(1);
      });

      it("should increment strikeouts correctly", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "strikeout",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.strikeouts).toBe(1);
        expect(result.batterStats.abs).toBe(1);
        expect(result.batterStats.hits).toBe(0);
      });

      it("should credit RBIs for scoring runners", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, true, true]; // Bases loaded

        const result = applyOutcome(
          "double",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.rbis).toBe(2); // Scores second and third
        expect(result.runsScored).toBe(2);
      });

      it("should credit RBI for grand slam", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, true, true];

        const result = applyOutcome(
          "homerun",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.rbis).toBe(4);
        expect(result.batterStats.runs).toBe(1); // Batter scores
        expect(result.runsScored).toBe(4);
      });

      it("should credit run to batter on homerun", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "homerun",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.batterStats.runs).toBe(1);
        expect(result.batterStats.rbis).toBe(1);
      });
    });

    describe("pitcher stats updates", () => {
      it("should track hits allowed", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.pitcherStats.hitsAllowed).toBe(1);
      });

      it("should track strikeouts", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "strikeout",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.pitcherStats.strikeouts).toBe(1);
        expect(result.pitcherStats.hitsAllowed).toBe(0);
      });

      it("should track walks", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "walk",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.pitcherStats.walks).toBe(1);
        expect(result.pitcherStats.hitsAllowed).toBe(0);
      });

      it("should track runs allowed", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, true];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.pitcherStats.runsAllowed).toBe(1);
        expect(result.runsScored).toBe(1);
      });
    });

    describe("game state updates", () => {
      it("should increment outs for strikeouts", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "strikeout",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.outs).toBe(1);
      });

      it("should increment outs for groundouts", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, false, false];

        const result = applyOutcome(
          "groundout",
          bases,
          batterStats,
          pitcherStats,
          1
        );

        expect(result.outs).toBe(2);
        expect(result.bases).toEqual([true, false, false]); // Runner stays
      });

      it("should not increment outs for hits", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          1
        );

        expect(result.outs).toBe(1); // Unchanged
      });

      it("should update bases correctly for single", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, false, false];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.bases).toEqual([true, true, false]);
      });
    });

    describe("complex scenarios", () => {
      it("should handle bases loaded walk correctly", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, true, true];

        const result = applyOutcome(
          "walk",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.bases).toEqual([true, true, true]);
        expect(result.runsScored).toBe(1);
        expect(result.batterStats.rbis).toBe(1);
        expect(result.batterStats.walks).toBe(1);
        expect(result.batterStats.abs).toBe(0); // Walks don't count as at-bats
        expect(result.outs).toBe(0);
      });

      it("should handle grand slam correctly", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, true, true];

        const result = applyOutcome(
          "homerun",
          bases,
          batterStats,
          pitcherStats,
          0
        );

        expect(result.bases).toEqual([false, false, false]);
        expect(result.runsScored).toBe(4);
        expect(result.batterStats.rbis).toBe(4);
        expect(result.batterStats.runs).toBe(1);
        expect(result.batterStats.hits).toBe(1);
        expect(result.batterStats.abs).toBe(1);
        expect(result.pitcherStats.hitsAllowed).toBe(1);
        expect(result.pitcherStats.runsAllowed).toBe(4);
      });

      it("should preserve existing stats while updating", () => {
        const batterStats = {
          hits: 2,
          abs: 5,
          strikeouts: 1,
          walks: 1,
          runs: 0,
          rbis: 1,
        };
        const pitcherStats = {
          hitsAllowed: 3,
          runsAllowed: 1,
          strikeouts: 4,
          walks: 2,
        };
        const bases: [boolean, boolean, boolean] = [false, false, false];

        const result = applyOutcome(
          "single",
          bases,
          batterStats,
          pitcherStats,
          1
        );

        expect(result.batterStats.hits).toBe(3);
        expect(result.batterStats.abs).toBe(6);
        expect(result.batterStats.strikeouts).toBe(1);
        expect(result.batterStats.walks).toBe(1);
        expect(result.pitcherStats.hitsAllowed).toBe(4);
        expect(result.pitcherStats.strikeouts).toBe(4);
      });

      it("should handle third out ending inning", () => {
        const batterStats = createEmptyStats();
        const pitcherStats = createEmptyPitcherStats();
        const bases: [boolean, boolean, boolean] = [true, true, true];

        const result = applyOutcome(
          "strikeout",
          bases,
          batterStats,
          pitcherStats,
          2
        );

        expect(result.outs).toBe(3);
        expect(result.runsScored).toBe(0); // No runs score on third out
        expect(result.bases).toEqual([true, true, true]); // Bases stay loaded
      });
    });
  });

  describe("getOutcomeDisplayText", () => {
    it("should return display text for outcomes", () => {
      const text = getOutcomeDisplayText("single");
      expect(text).toBeTruthy();
      expect(typeof text).toBe("string");
    });

    it("should append RBI info when provided", () => {
      const text = getOutcomeDisplayText("double", 2);
      expect(text).toContain("2 RBI");
    });

    it("should handle single RBI", () => {
      const text = getOutcomeDisplayText("single", 1);
      expect(text).toContain("1 RBI");
    });

    it("should not append RBI for zero runs", () => {
      const text = getOutcomeDisplayText("single", 0);
      expect(text).not.toContain("RBI");
    });

    it("should return valid text for all outcome types", () => {
      const outcomes = [
        "strikeout",
        "walk",
        "single",
        "double",
        "triple",
        "homerun",
        "groundout",
        "flyout",
        "lineout",
        "popout",
      ] as const;

      outcomes.forEach((outcome) => {
        const text = getOutcomeDisplayText(outcome);
        expect(text).toBeTruthy();
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });
});
