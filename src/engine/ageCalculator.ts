/**
 * Age Curve & Skill Ceiling Calculator — Phase 1 Mental Skills
 *
 * Physical vs mental age curves are intentionally opposite:
 *   Physical: sharp peak at 26-27, meaningful decline by 35
 *   Mental:   late bloom at 33-35, plateau persists through 50
 *
 * This creates genuinely different player archetypes at different career stages.
 */

import type { PhysicalPotential } from "@/types/mentalSkills";

// ─── Physical Age Modifier ────────────────────────────────────────────────────

/**
 * Returns a multiplier (0.60–1.00) for physical skill effectiveness at a given age.
 *
 * Piecewise linear:
 *   18–27: ramp up  (0.70 → 1.00)
 *   27–35: decline  (1.00 → 0.84)
 *   35–42: steeper decline (0.84 → 0.60)
 *   42+:   floor at 0.60
 *   <18:   floor at 0.70
 */
export function getPhysicalAgeModifier(age: number): number {
  if (age <= 18) return 0.70;
  if (age <= 27) {
    // 0.70 at 18, 1.00 at 27 — slope: +0.0333/yr
    return 0.70 + (age - 18) * (0.30 / 9);
  }
  if (age <= 35) {
    // 1.00 at 27, 0.84 at 35 — slope: -0.02/yr
    return 1.00 - (age - 27) * (0.16 / 8);
  }
  if (age <= 42) {
    // 0.84 at 35, 0.60 at 42 — slope: -0.0343/yr
    return 0.84 - (age - 35) * (0.24 / 7);
  }
  return 0.60; // floor
}

// ─── Mental Age Modifier ───────────────────────────────────────────────────────

/**
 * Returns a multiplier (0.50–1.15) for mental skill effectiveness at a given age.
 *
 * Piecewise linear:
 *   18–20: early growth  (0.50 → 0.65)
 *   20–33: steady climb  (0.65 → 1.00)
 *   33–35: peak plateau  (1.00)
 *   35–50: gentle drift  (1.00 → 0.95)
 *   50+:   floor at 0.95
 *   <18:   floor at 0.50
 *
 * Note: mental modifier can exceed 1.0 if future design adds bonus ranges.
 * Currently capped at 1.0 for the plateau period.
 */
export function getMentalAgeModifier(age: number): number {
  if (age <= 18) return 0.50;
  if (age <= 20) {
    // 0.50 at 18, 0.65 at 20 — slope: +0.075/yr
    return 0.50 + (age - 18) * (0.15 / 2);
  }
  if (age <= 33) {
    // 0.65 at 20, 1.00 at 33 — slope: +0.0269/yr
    return 0.65 + (age - 20) * (0.35 / 13);
  }
  if (age <= 35) {
    // plateau at 1.00
    return 1.00;
  }
  if (age <= 50) {
    // 1.00 at 35, 0.95 at 50 — slope: -0.00333/yr
    return 1.00 - (age - 35) * (0.05 / 15);
  }
  return 0.95; // floor
}

// ─── Skill Ceiling ────────────────────────────────────────────────────────────

/**
 * Physical skill ceiling — the maximum rank achievable by this player for a
 * physical skill, given their attribute score and seasons played.
 *
 * Formula:  MIN(10, floor((attribute / 10) + 3), floor((seasons / 2) + 5))
 *
 * @param attribute  - Relevant stat value (0–100), e.g. power, contact, velocity
 * @param seasons    - Career seasons played (0+)
 * @returns          - Integer ceiling rank (0–10)
 */
export function calculatePhysicalSkillCeiling(
  attribute: number,
  seasons: number
): number {
  const fromAttribute = Math.floor(attribute / 10) + 3;
  const fromExperience = Math.floor(seasons / 2) + 5;
  return Math.min(10, fromAttribute, fromExperience);
}

/**
 * Mental skill ceiling — always 10.
 * Mental skills have no hard cap; they're limited only by XP and confidence.
 */
export function calculateMentalSkillCeiling(): number {
  return 10;
}

// ─── Effective Stat with Age ──────────────────────────────────────────────────

/**
 * Apply physical age modifier to a raw stat value.
 * Result is clamped to [0, 100].
 */
export function applyPhysicalAgeCurve(
  rawStat: number,
  age: number
): number {
  return Math.max(0, Math.min(100, Math.round(rawStat * getPhysicalAgeModifier(age))));
}

/**
 * Apply mental age modifier to a raw mental skill bonus.
 * Result is clamped to [0, 100].
 */
export function applyMentalAgeCurve(
  rawBonus: number,
  age: number
): number {
  return Math.max(0, Math.min(100, Math.round(rawBonus * getMentalAgeModifier(age))));
}

// ─── Physical Potential Helpers ────────────────────────────────────────────────

/**
 * Get the physical skill ceiling for a batter given their physical potential.
 * Selects the most relevant attribute from PhysicalPotential based on skill type.
 */
export function getBatterSkillCeiling(
  potential: PhysicalPotential,
  skillType: "power" | "contact" | "speed",
  seasons: number
): number {
  const attribute =
    skillType === "power"
      ? potential.strength
      : skillType === "contact"
        ? potential.agility
        : potential.agility;
  return calculatePhysicalSkillCeiling(attribute, seasons);
}

/**
 * Get the physical skill ceiling for a pitcher.
 */
export function getPitcherSkillCeiling(
  potential: PhysicalPotential,
  skillType: "velocity" | "control" | "break",
  seasons: number
): number {
  const attribute =
    skillType === "velocity"
      ? potential.armStrength
      : skillType === "break"
        ? potential.breakMastery
        : potential.agility;
  return calculatePhysicalSkillCeiling(attribute, seasons);
}
