/**
 * Mental Skill Display Helpers
 *
 * Pure functions used by the Skill Compass UI component to transform
 * raw Player data into display-ready representations.
 * All functions are side-effect-free and fully unit-tested.
 */

import type { Player } from "@/types/game";
import {
  type MentalSkillType,
  CONFIDENCE_ACTIVE_THRESHOLD,
} from "@/types/mentalSkills";
import type { SignatureSkill } from "@/types/breakthroughs";

// ─────────────────────────────────────────────────────────────────────────────
// Display state classification
// ─────────────────────────────────────────────────────────────────────────────

export type SkillDisplayState = "active" | "dormant" | "undiscovered";

/**
 * Returns the display state for a single mental skill on a player.
 *
 *   active       — skill discovered AND confidence ≥ threshold
 *   dormant      — skill discovered BUT confidence < threshold (inactive)
 *   undiscovered — skill not yet in the player's mentalSkills array
 */
export function getSkillDisplayState(
  player: Player,
  skillType: MentalSkillType
): SkillDisplayState {
  const skill = player.mentalSkills?.find((s) => s.skillId === skillType);
  if (!skill) return "undiscovered";
  return skill.confidence >= CONFIDENCE_ACTIVE_THRESHOLD ? "active" : "dormant";
}

/**
 * Returns the rank (0–5) for a mental skill on a player.
 * Returns 0 if the skill hasn't been discovered yet.
 */
export function getSkillRank(player: Player, skillType: MentalSkillType): number {
  const skill = player.mentalSkills?.find((s) => s.skillId === skillType);
  return skill?.rank ?? 0;
}

/**
 * Returns the confidence level (0–100) for a mental skill on a player.
 * Returns 0 if the skill hasn't been discovered yet.
 */
export function getSkillConfidence(
  player: Player,
  skillType: MentalSkillType
): number {
  const skill = player.mentalSkills?.find((s) => s.skillId === skillType);
  return skill?.confidence ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature skill lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the first active (non-archived) signature skill the player has, or
 * undefined if none exist.
 */
export function getActiveSignatureSkill(player: Player): SignatureSkill | undefined {
  if (!player.signatureSkills) return undefined;
  for (const sig of player.signatureSkills.values()) {
    if (sig.isActive && !sig.isArchived) return sig;
  }
  return undefined;
}

/**
 * Returns all archived (legacy) signature skills — ones that were earned but
 * replaced via reinvention.
 */
export function getArchivedSignatureSkills(player: Player): SignatureSkill[] {
  if (!player.signatureSkills) return [];
  return Array.from(player.signatureSkills.values()).filter((s) => s.isArchived);
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar / Compass geometry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered axis configuration for the Skill Compass pentagon.
 * The five mental skills are mapped to the five corners of the pentagon.
 * Starting at the top (−90°) and going clockwise in 72° steps.
 */
export const COMPASS_AXES: readonly {
  skillId: MentalSkillType;
  label: string;
  trait: string;
  angleDeg: number;
}[] = [
  { skillId: "ice_veins",        label: "Ice Veins",        trait: "Ice",   angleDeg: -90 },
  { skillId: "pitch_recognition", label: "Pitch Recognition", trait: "Eye",   angleDeg: -18 },
  { skillId: "clutch_composure", label: "Clutch Composure", trait: "Heart", angleDeg:  54 },
  { skillId: "veteran_poise",    label: "Veteran Poise",    trait: "Wile",  angleDeg: 126 },
  { skillId: "game_reading",     label: "Game Reading",     trait: "Brain", angleDeg: 198 },
];

/**
 * Converts polar coordinates (angle in degrees, radius) to Cartesian x/y,
 * offset by the given center point.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/**
 * Builds an SVG `points` attribute string for a radar polygon.
 *
 * @param ranks  Array of 5 rank values (0–5), in COMPASS_AXES order
 * @param cx     SVG center X
 * @param cy     SVG center Y
 * @param maxR   Radius when rank = 5
 *
 * Skills with rank 0 are plotted at the center (they produce a point at
 * cx,cy so the polygon still closes cleanly for very-low-rank players).
 */
export function buildRadarPoints(
  ranks: readonly number[],
  cx: number,
  cy: number,
  maxR: number
): string {
  return COMPASS_AXES.map(({ angleDeg }, i) => {
    const r = ((ranks[i] ?? 0) / 5) * maxR;
    const { x, y } = polarToCartesian(cx, cy, r, angleDeg);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

/**
 * Builds SVG points for a reference ring at a given rank level (1–5).
 * Used to draw the grid lines on the compass background.
 */
export function buildReferenceRingPoints(
  cx: number,
  cy: number,
  maxR: number,
  rank: 1 | 2 | 3 | 4 | 5
): string {
  const r = (rank / 5) * maxR;
  return COMPASS_AXES.map(({ angleDeg }) => {
    const { x, y } = polarToCartesian(cx, cy, r, angleDeg);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

/**
 * Summarises a player's mental skill profile for display.
 * Returns aggregated counts by state so the panel can show a "X active / Y dormant" line.
 */
export function getMentalSkillSummary(player: Player): {
  active: number;
  dormant: number;
  undiscovered: number;
  totalRanks: number;
} {
  let active = 0;
  let dormant = 0;
  let undiscovered = 0;
  let totalRanks = 0;

  for (const { skillId } of COMPASS_AXES) {
    const state = getSkillDisplayState(player, skillId);
    const rank = getSkillRank(player, skillId);
    totalRanks += rank;
    if (state === "active") active++;
    else if (state === "dormant") dormant++;
    else undiscovered++;
  }

  return { active, dormant, undiscovered, totalRanks };
}
