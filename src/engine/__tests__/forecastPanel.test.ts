import { describe, expect, it } from "vitest";
import {
  buildForecastSnapshot,
  getAdaptationWarning,
  getFatiguePreview,
  getOutcomeTilt,
  getRiskTag,
} from "../forecastPanel";

describe("forecastPanel", () => {
  describe("getRiskTag", () => {
    it("returns high risk for power batting approach", () => {
      const risk = getRiskTag({
        mode: "batting",
        approach: "power",
        lastApproach: null,
        consecutiveApproach: 0,
      });
      expect(risk).toBe("High");
    });

    it("returns low risk for contact batting approach", () => {
      const risk = getRiskTag({
        mode: "batting",
        approach: "contact",
        lastApproach: null,
        consecutiveApproach: 0,
      });
      expect(risk).toBe("Low");
    });

    it("returns high risk for challenge pitching strategy", () => {
      const risk = getRiskTag({
        mode: "pitching",
        strategy: "challenge",
        lastStrategy: null,
        consecutiveStrategy: 0,
      });
      expect(risk).toBe("High");
    });

    it("returns low risk for finesse pitching strategy", () => {
      const risk = getRiskTag({
        mode: "pitching",
        strategy: "finesse",
        lastStrategy: null,
        consecutiveStrategy: 0,
      });
      expect(risk).toBe("Low");
    });
  });

  describe("getOutcomeTilt", () => {
    it("maps patient approach to elevated walk pressure", () => {
      const tilt = getOutcomeTilt({
        mode: "batting",
        approach: "patient",
        lastApproach: null,
        consecutiveApproach: 0,
      });
      expect(tilt.bbPressure).toBe("High");
    });

    it("maps challenge strategy to lower strikeout risk for offense", () => {
      const tilt = getOutcomeTilt({
        mode: "pitching",
        strategy: "challenge",
        lastStrategy: null,
        consecutiveStrategy: 0,
      });
      expect(tilt.kRisk).toBe("Low");
    });
  });

  describe("adaptation + fatigue helpers", () => {
    it("returns null adaptation warning when no penalty (all PENALTY_SCALE = 1.0)", () => {
      // Current design: PENALTY_SCALE is all 1.0 (no effectiveness loss)
      // So repeated approaches have no penalty and return null
      const warning = getAdaptationWarning({
        mode: "batting",
        approach: "power",
        lastApproach: "power",
        consecutiveApproach: 2,
      });
      expect(warning).toBeNull();
    });

    it("returns null adaptation warning for repeated strategy (no penalty)", () => {
      const warning = getAdaptationWarning({
        mode: "pitching",
        strategy: "paint",
        lastStrategy: "paint",
        consecutiveStrategy: 3,
      });
      expect(warning).toBeNull();
    });

    it("returns patient fatigue preview", () => {
      const preview = getFatiguePreview({
        mode: "batting",
        approach: "patient",
        lastApproach: null,
        consecutiveApproach: 0,
      });
      expect(preview).toContain("opp pitcher fatigue");
    });

    it("returns paint fatigue preview", () => {
      const preview = getFatiguePreview({
        mode: "pitching",
        strategy: "paint",
        lastStrategy: null,
        consecutiveStrategy: 0,
      });
      expect(preview).toContain("your pitcher fatigue");
    });

    it("builds complete forecast snapshot", () => {
      const snapshot = buildForecastSnapshot({
        mode: "batting",
        approach: "contact",
        lastApproach: "power",
        consecutiveApproach: 1,
      });

      expect(snapshot.riskTag).toBeDefined();
      expect(snapshot.tilt.kRisk).toBeDefined();
      expect(snapshot.tilt.bbPressure).toBeDefined();
      expect(snapshot.tilt.xbhPressure).toBeDefined();
    });
  });
});
