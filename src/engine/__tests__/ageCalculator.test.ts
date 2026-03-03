import { describe, it, expect } from "vitest";
import {
  getPhysicalAgeModifier,
  getMentalAgeModifier,
  calculatePhysicalSkillCeiling,
  calculateMentalSkillCeiling,
  applyPhysicalAgeCurve,
  applyMentalAgeCurve,
  getBatterSkillCeiling,
  getPitcherSkillCeiling,
} from "@/engine/ageCalculator";
import type { PhysicalPotential } from "@/types/mentalSkills";

// ─── Physical Age Modifier ───────────────────────────────────────────────────

describe("getPhysicalAgeModifier", () => {
  describe("boundary conditions", () => {
    it("returns 0.70 at age 18 (start of ramp)", () => {
      expect(getPhysicalAgeModifier(18)).toBeCloseTo(0.70, 4);
    });

    it("returns 0.70 for age < 18 (floor)", () => {
      expect(getPhysicalAgeModifier(16)).toBeCloseTo(0.70, 4);
      expect(getPhysicalAgeModifier(0)).toBeCloseTo(0.70, 4);
    });

    it("returns 1.00 at age 27 (physical peak)", () => {
      expect(getPhysicalAgeModifier(27)).toBeCloseTo(1.00, 4);
    });

    it("returns 0.84 at age 35 (post-peak decline)", () => {
      expect(getPhysicalAgeModifier(35)).toBeCloseTo(0.84, 3);
    });

    it("returns 0.60 at age 42 (steep decline end)", () => {
      expect(getPhysicalAgeModifier(42)).toBeCloseTo(0.60, 3);
    });

    it("returns 0.60 for age > 42 (floor)", () => {
      expect(getPhysicalAgeModifier(45)).toBeCloseTo(0.60, 4);
      expect(getPhysicalAgeModifier(60)).toBeCloseTo(0.60, 4);
    });
  });

  describe("monotonicity — values increase through prime then decrease", () => {
    it("increases from 18 to 27", () => {
      const ages = [18, 20, 23, 25, 27];
      for (let i = 1; i < ages.length; i++) {
        expect(getPhysicalAgeModifier(ages[i])).toBeGreaterThan(
          getPhysicalAgeModifier(ages[i - 1])
        );
      }
    });

    it("decreases from 27 to 42", () => {
      const ages = [27, 30, 33, 35, 38, 42];
      for (let i = 1; i < ages.length; i++) {
        expect(getPhysicalAgeModifier(ages[i])).toBeLessThanOrEqual(
          getPhysicalAgeModifier(ages[i - 1])
        );
      }
    });
  });

  describe("range constraints", () => {
    it("always returns between 0.60 and 1.00 for any age", () => {
      for (let age = 16; age <= 55; age++) {
        const val = getPhysicalAgeModifier(age);
        expect(val).toBeGreaterThanOrEqual(0.60);
        expect(val).toBeLessThanOrEqual(1.00);
      }
    });
  });

  describe("mid-range interpolation", () => {
    it("age 22 is between 18 and 27 values (ascending)", () => {
      const at22 = getPhysicalAgeModifier(22);
      expect(at22).toBeGreaterThan(0.70);
      expect(at22).toBeLessThan(1.00);
    });

    it("age 31 is between 27 and 35 values (descending)", () => {
      const at31 = getPhysicalAgeModifier(31);
      expect(at31).toBeGreaterThan(0.84);
      expect(at31).toBeLessThan(1.00);
    });

    it("age 39 is between 35 and 42 values (steeper decline)", () => {
      const at39 = getPhysicalAgeModifier(39);
      expect(at39).toBeGreaterThan(0.60);
      expect(at39).toBeLessThan(0.84);
    });
  });
});

// ─── Mental Age Modifier ─────────────────────────────────────────────────────

describe("getMentalAgeModifier", () => {
  describe("boundary conditions", () => {
    it("returns 0.50 at age 18 (start)", () => {
      expect(getMentalAgeModifier(18)).toBeCloseTo(0.50, 4);
    });

    it("returns 0.50 for age < 18 (floor)", () => {
      expect(getMentalAgeModifier(15)).toBeCloseTo(0.50, 4);
      expect(getMentalAgeModifier(0)).toBeCloseTo(0.50, 4);
    });

    it("returns 0.65 at age 20", () => {
      expect(getMentalAgeModifier(20)).toBeCloseTo(0.65, 3);
    });

    it("returns 1.00 at age 33 (mental peak starts)", () => {
      expect(getMentalAgeModifier(33)).toBeCloseTo(1.00, 3);
    });

    it("returns 1.00 at age 35 (plateau end)", () => {
      expect(getMentalAgeModifier(35)).toBeCloseTo(1.00, 3);
    });

    it("returns 0.95 at age 50 (gentle decline floor)", () => {
      expect(getMentalAgeModifier(50)).toBeCloseTo(0.95, 3);
    });

    it("returns 0.95 for age > 50 (floor)", () => {
      expect(getMentalAgeModifier(55)).toBeCloseTo(0.95, 4);
      expect(getMentalAgeModifier(70)).toBeCloseTo(0.95, 4);
    });
  });

  describe("mental peaks later than physical", () => {
    it("mental modifier at 33 (1.00) > physical modifier at 33 (0.88)", () => {
      const mental = getMentalAgeModifier(33);
      const physical = getPhysicalAgeModifier(33);
      expect(mental).toBeGreaterThan(physical);
    });

    it("mental modifier at 40 still near 0.97 while physical is 0.69", () => {
      const mental = getMentalAgeModifier(40);
      const physical = getPhysicalAgeModifier(40);
      expect(mental).toBeGreaterThan(0.95);
      expect(physical).toBeLessThan(0.75);
    });
  });

  describe("monotonicity", () => {
    it("increases from 18 to 33", () => {
      const ages = [18, 20, 24, 28, 33];
      for (let i = 1; i < ages.length; i++) {
        expect(getMentalAgeModifier(ages[i])).toBeGreaterThan(
          getMentalAgeModifier(ages[i - 1])
        );
      }
    });

    it("stays flat between 33 and 35 (plateau)", () => {
      expect(getMentalAgeModifier(34)).toBeCloseTo(1.00, 3);
    });

    it("decreases very slowly from 35 to 50", () => {
      const at35 = getMentalAgeModifier(35);
      const at42 = getMentalAgeModifier(42);
      const at50 = getMentalAgeModifier(50);
      expect(at35).toBeGreaterThan(at42);
      expect(at42).toBeGreaterThan(at50);
      // Decline should be very gentle — at most ~0.05 over 15 years (float precision tolerated)
      expect(at35 - at50).toBeLessThanOrEqual(0.051);
    });
  });

  describe("range constraints", () => {
    it("always returns between 0.50 and 1.00 for any age", () => {
      for (let age = 15; age <= 60; age++) {
        const val = getMentalAgeModifier(age);
        expect(val).toBeGreaterThanOrEqual(0.50);
        expect(val).toBeLessThanOrEqual(1.00);
      }
    });
  });
});

// ─── Physical Skill Ceiling ──────────────────────────────────────────────────

describe("calculatePhysicalSkillCeiling", () => {
  it("Strength 70, 2 seasons → ceiling 10 (capped by experience: floor(2/2)+5=6, attr: floor(70/10)+3=10 → min=6)", () => {
    // min(10, 10, 6) = 6
    expect(calculatePhysicalSkillCeiling(70, 2)).toBe(6);
  });

  it("Strength 40, 5 seasons → ceiling 7 (attr: floor(40/10)+3=7, exp: floor(5/2)+5=7 → min=7)", () => {
    // min(10, 7, 7) = 7
    expect(calculatePhysicalSkillCeiling(40, 5)).toBe(7);
  });

  it("Strength 100, 10 seasons → ceiling 10 (attr: 13, exp: 10 → min=10)", () => {
    // min(10, 13, 10) = 10
    expect(calculatePhysicalSkillCeiling(100, 10)).toBe(10);
  });

  it("Strength 20, 0 seasons → ceiling 5 (attr: 5, exp: 5 → min=5)", () => {
    // min(10, 5, 5) = 5
    expect(calculatePhysicalSkillCeiling(20, 0)).toBe(5);
  });

  it("never exceeds 10 regardless of attribute or seasons", () => {
    expect(calculatePhysicalSkillCeiling(100, 100)).toBe(10);
    expect(calculatePhysicalSkillCeiling(200, 50)).toBe(10);
  });

  it("Strength 60, 6 seasons → ceiling 9 (attr: 9, exp: 8 → min=9)", () => {
    // min(10, 9, 8) = 8
    expect(calculatePhysicalSkillCeiling(60, 6)).toBe(8);
  });

  it("Strength 80, 4 seasons → ceiling 7 (attr: 11, exp: 7 → min=7)", () => {
    // min(10, 11, 7) = 7
    expect(calculatePhysicalSkillCeiling(80, 4)).toBe(7);
  });
});

// ─── Mental Skill Ceiling ─────────────────────────────────────────────────────

describe("calculateMentalSkillCeiling", () => {
  it("always returns 10", () => {
    expect(calculateMentalSkillCeiling()).toBe(10);
  });
});

// ─── Age Curve Application ────────────────────────────────────────────────────

describe("applyPhysicalAgeCurve", () => {
  it("a 27-year-old at peak keeps full stat (100 → 100)", () => {
    expect(applyPhysicalAgeCurve(100, 27)).toBe(100);
  });

  it("a 42-year-old has reduced stat (100 → 60)", () => {
    expect(applyPhysicalAgeCurve(100, 42)).toBe(60);
  });

  it("clamps below 0 to 0", () => {
    expect(applyPhysicalAgeCurve(0, 42)).toBe(0);
  });

  it("clamps above 100 to 100", () => {
    expect(applyPhysicalAgeCurve(100, 27)).toBe(100);
  });

  it("18-year-old at 70 power has ~49 effective (70 * 0.70)", () => {
    expect(applyPhysicalAgeCurve(70, 18)).toBeCloseTo(49, 0);
  });
});

describe("applyMentalAgeCurve", () => {
  it("33-year-old at mental peak gets full bonus", () => {
    expect(applyMentalAgeCurve(100, 33)).toBe(100);
  });

  it("18-year-old gets 50% of mental bonus", () => {
    expect(applyMentalAgeCurve(100, 18)).toBe(50);
  });

  it("50-year-old retains ~95% of mental bonus", () => {
    expect(applyMentalAgeCurve(100, 50)).toBeCloseTo(95, 0);
  });
});

// ─── Physical Potential Helpers ───────────────────────────────────────────────

const highPotential: PhysicalPotential = {
  strength: 100,
  agility: 80,
  armStrength: 80,
  breakMastery: 60,
};

const lowPotential: PhysicalPotential = {
  strength: 40,
  agility: 40,
  armStrength: 40,
  breakMastery: 40,
};

describe("getBatterSkillCeiling", () => {
  it("high strength potential, 8 seasons → power ceiling 9", () => {
    // attr: floor(100/10)+3=13, exp: floor(8/2)+5=9 → min(10,13,9)=9
    expect(getBatterSkillCeiling(highPotential, "power", 8)).toBe(9);
  });

  it("low agility potential, 0 seasons → contact ceiling 5", () => {
    // attr: floor(40/10)+3=7, exp: floor(0/2)+5=5 → min(10,7,5)=5
    expect(getBatterSkillCeiling(lowPotential, "contact", 0)).toBe(5);
  });

  it("high agility, 10 seasons → speed ceiling 10", () => {
    // attr: floor(80/10)+3=11, exp: floor(10/2)+5=10 → min(10,11,10)=10
    expect(getBatterSkillCeiling(highPotential, "speed", 10)).toBe(10);
  });
});

describe("getPitcherSkillCeiling", () => {
  it("high arm potential, 6 seasons → velocity ceiling 8", () => {
    // attr: floor(80/10)+3=11, exp: floor(6/2)+5=8 → min(10,11,8)=8
    expect(getPitcherSkillCeiling(highPotential, "velocity", 6)).toBe(8);
  });

  it("low break potential, 2 seasons → break ceiling 6", () => {
    // attr: floor(60/10)+3=9, exp: floor(2/2)+5=6 → min(10,9,6)=6
    expect(getPitcherSkillCeiling(highPotential, "break", 2)).toBe(6);
  });

  it("low arm potential, 4 seasons → velocity ceiling 7", () => {
    // attr: floor(40/10)+3=7, exp: floor(4/2)+5=7 → min(10,7,7)=7
    expect(getPitcherSkillCeiling(lowPotential, "velocity", 4)).toBe(7);
  });
});
