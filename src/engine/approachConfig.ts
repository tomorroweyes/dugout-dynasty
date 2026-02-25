/**
 * Batter Approach & Pitch Strategy Configuration
 *
 * Approaches differ in RISK PROFILE, not just stat bumps:
 * - Power: High variance (HR upside, K downside)
 * - Contact: Low variance (reliable ball-in-play, low ceiling)
 * - Patient: Deferred value (wears down pitcher for future at-bats)
 *
 * Strategies mirror this for pitchers:
 * - Challenge: High K upside, but dangerous if they connect
 * - Finesse: Weak contact, fewer XBH, but fewer Ks — more balls in play
 * - Paint: Elite control, but exhausting to sustain (extra fatigue cost)
 *
 * For context on the math:
 * - strikeoutChance = (V + B + Ctrl*0.4 - C) / 1.8, so +8 contact ≈ -4.4% K rate
 * - walkChance = (100-Ctrl)/12 + max(0, C-40)/20, so +5 walkBonus = +5% walk rate
 * - netScore = (P+C)*1.2 - (V+B+Ctrl)*0.9 - Glove*0.8
 * - hitRoll = rng*100 + netScore + (P-50)*0.15, so power shifts XBH outcomes
 * - homerunBonus shifts HR boundary directly (e.g. +8 = 8 points closer to HR threshold)
 */

import type { BatterApproachConfig, PitchStrategyConfig } from "@/types/approach";

export const BATTER_APPROACHES: Record<string, BatterApproachConfig> = {
  power: {
    id: "power",
    label: "Power",
    description: "Swing for the fences. Home run upside, but high strikeout risk.",
    shortDescription: "High risk, high reward",
    icon: "💥",
    statModifiers: {
      power: 10,
      contact: -8,
    },
    outcomeModifiers: {
      homerunBonus: 8,
      strikeoutBonus: 5,
      hitBonus: -3,
    },
  },
  contact: {
    id: "contact",
    label: "Contact",
    description: "Put the ball in play. Reliable singles, fewer big moments.",
    shortDescription: "Low risk, steady",
    icon: "🎯",
    statModifiers: {
      contact: 8,
      power: -6,
    },
    outcomeModifiers: {
      strikeoutBonus: -5,
      homerunBonus: -4,
      hitBonus: 3,
    },
  },
  patient: {
    id: "patient",
    label: "Patient",
    description: "Work the count. Wears down the pitcher for teammates behind you.",
    shortDescription: "Tire the pitcher",
    icon: "👁️",
    statModifiers: {
      contact: 3,
      power: -6,
    },
    outcomeModifiers: {
      walkBonus: 5,
      strikeoutBonus: -3,
      homerunBonus: -6,
    },
    fatigueEffect: 0.15,
  },
};

export const PITCH_STRATEGIES: Record<string, PitchStrategyConfig> = {
  challenge: {
    id: "challenge",
    label: "Challenge",
    description: "Bring the heat. Strikeout potential, but dangerous if they connect.",
    shortDescription: "Power pitching",
    icon: "🔥",
    statModifiers: {
      velocity: 8,
      control: -6,
    },
    outcomeModifiers: {
      strikeoutBonus: 4,
      homerunBonus: 4,
    },
  },
  finesse: {
    id: "finesse",
    label: "Finesse",
    description: "Change speeds. Weak contact and fewer extra-base hits.",
    shortDescription: "Induce weak contact",
    icon: "🌊",
    statModifiers: {
      break: 8,
      velocity: -6,
    },
    outcomeModifiers: {
      hitBonus: -5,
      strikeoutBonus: -3,
      homerunBonus: -5,
    },
  },
  paint: {
    id: "paint",
    label: "Paint",
    description: "Nibble the corners. Elite control, but exhausting to sustain.",
    shortDescription: "Precise but tiring",
    icon: "🎨",
    statModifiers: {
      control: 8,
      velocity: -4,
    },
    outcomeModifiers: {
      walkBonus: -3,
      homerunBonus: -4,
      strikeoutBonus: -1,
    },
    fatigueCost: 0.2,
  },
};
