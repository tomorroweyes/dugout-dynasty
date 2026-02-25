/**
 * Zone Read System
 *
 * Powers the 3×3 pitch zone minigame for both batting and pitching.
 *
 * Batting: player predicts where the pitch will land and clicks that zone.
 *   - Correct read → hitBonus
 *   - Correct read in non-cold zone → natural 20 (guaranteed outcome upgrade)
 *
 * Pitching: player aims at a zone; execution variance (based on Control stat)
 *   may shift the landing 1 cell. Hitting cold zones rewards the pitcher.
 *   - Cold corner hit perfectly → natural 20
 *
 * Zone Physics: every cell has inherent tendencies based on physical pitch
 *   location (high = more K + HR loft, low = groundballs, outside = more walks,
 *   inside = pull power). These apply to the landing zone independent of the
 *   player's hot/cold map and are identical for batting and pitching perspectives.
 */

import type { Player, BatterStats, PitcherStats } from "@/types/game";
import { calculatePlayerStatsWithEquipment } from "./itemStatsCalculator";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { RandomProvider } from "./randomProvider";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ZoneRow = 0 | 1 | 2;
export type ZoneCol = 0 | 1 | 2;

export interface ZoneCell {
  row: ZoneRow;
  col: ZoneCol;
}

export type ZoneType = "hot" | "neutral" | "cold";

/** Row-major 3×3 grid. zones[row][col] */
export type ZoneMap = ZoneType[][];

export interface ZoneModifier {
  strikeoutBonus: number;
  hitBonus: number;
  homerunBonus: number;
  walkBonus: number;
  isPerfect: boolean;
  landingZone: ZoneCell;
}

// ─── Zone Physics ─────────────────────────────────────────────────────────────

/**
 * Inherent outcome tendencies for each pitch location, independent of the
 * player's hot/cold map. Applied additively to the landing zone in both
 * batting and pitching modifier calculations.
 *
 * Row 0 (High): harder to make contact (K↑), but lofted when hit (HR↑)
 * Row 2 (Low):  induced groundballs (HR↓), more chased balls (W↑)
 * Col 0 (In):   jam zone or pull power (K↑ or HR↑)
 * Col 1 (Mid):  easiest to barrel (K↓) — the "groove" location
 * Col 2 (Out):  push to opposite field (HR↓), more walks
 */
const ZONE_PHYSICS: {
  [R in ZoneRow]: { [C in ZoneCol]: { strikeoutBonus: number; homerunBonus: number; walkBonus: number } };
} = {
  0: {
    0: { strikeoutBonus:  3, homerunBonus:  6, walkBonus: 1 }, // HI-IN:  jam or bomb
    1: { strikeoutBonus:  1, homerunBonus:  4, walkBonus: 1 }, // HI-MID: power zone
    2: { strikeoutBonus:  3, homerunBonus:  2, walkBonus: 2 }, // HI-OUT: chase zone
  },
  1: {
    0: { strikeoutBonus:  1, homerunBonus:  2, walkBonus: 0 }, // MID-IN:  pull power
    1: { strikeoutBonus: -1, homerunBonus:  0, walkBonus: 0 }, // MID-MID: groove (easiest to hit)
    2: { strikeoutBonus:  1, homerunBonus: -2, walkBonus: 1 }, // MID-OUT: contact zone
  },
  2: {
    0: { strikeoutBonus:  2, homerunBonus: -2, walkBonus: 1 }, // LO-IN:  groundball inside
    1: { strikeoutBonus:  0, homerunBonus: -4, walkBonus: 1 }, // LO-MID: safe groundball
    2: { strikeoutBonus:  2, homerunBonus: -6, walkBonus: 2 }, // LO-OUT: most walks, no HR
  },
};

function applyPhysics(
  base: Omit<ZoneModifier, "landingZone">,
  landing: ZoneCell
): ZoneModifier {
  const p = ZONE_PHYSICS[landing.row][landing.col];
  return {
    ...base,
    strikeoutBonus: base.strikeoutBonus + p.strikeoutBonus,
    homerunBonus:   base.homerunBonus   + p.homerunBonus,
    walkBonus:      base.walkBonus      + p.walkBonus,
    landingZone:    landing,
  };
}

// ─── Zone Map Derivation ──────────────────────────────────────────────────────

/**
 * Derive a batter's hot/cold zone map from their power and contact stats.
 * Hot zones: where this batter excels. Cold zones: where they struggle.
 * Result is deterministic for a given player — same zones every at-bat.
 */
export function deriveZoneMap(batter: Player): ZoneMap {
  const stats = calculatePlayerStatsWithEquipment(batter) as BatterStats;
  const power = stats.power ?? 50;
  const contact = stats.contact ?? 50;

  // Start neutral
  const zones: ZoneType[][] = [
    ["neutral", "neutral", "neutral"],
    ["neutral", "neutral", "neutral"],
    ["neutral", "neutral", "neutral"],
  ];

  // Power hitters: hot high-inside (pull zone), cold low-outside
  if (power > 65) {
    zones[0][0] = "hot"; // high-inside
    zones[0][1] = "hot"; // high-middle
  }
  if (power < 40) {
    zones[0][0] = "cold"; // can't handle high heat
    zones[0][1] = "cold";
  }

  // Contact hitters: hot middle zones (go-opposite-field ability)
  if (contact > 65) {
    zones[1][1] = "hot"; // middle-middle
    zones[1][2] = "hot"; // middle-outside (slap/oppo)
  }
  if (contact < 40) {
    zones[0][2] = "cold"; // high-away — no coverage
    zones[2][2] = "cold"; // low-away — chase zone
  }

  // Balanced hitter (both > 60): reinforce center zone
  if (power > 60 && contact > 60) {
    zones[1][1] = "hot";
  }

  return zones;
}

// ─── Pitch Tendency (batting hint) ───────────────────────────────────────────

/**
 * Derive the 1–2 zones this pitcher tends to throw to.
 * Shown as faint hints in the batting view — partial intel, not exact location.
 */
export function derivePitchTendency(pitcher: Player): ZoneCell[] {
  const stats = calculatePlayerStatsWithEquipment(pitcher) as PitcherStats;
  const velocity = stats.velocity ?? 50;
  const control = stats.control ?? 50;
  const brk = stats.break ?? 50;

  if (velocity > 65) {
    // Power pitcher: works up and in
    return [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
  }
  if (brk > 65) {
    // Breaking-ball pitcher: works low
    return [
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ];
  }
  if (control > 65) {
    // Precision pitcher: works the corners
    return [
      { row: 0, col: 2 },
      { row: 2, col: 0 },
    ];
  }
  // Default: middle-in
  return [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ];
}

// ─── Pitch Landing Resolution (pitching execution variance) ──────────────────

const ADJACENT_OFFSETS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Resolve where a pitched ball actually lands given the pitcher's aim and
 * their Control stat. Low-control pitchers miss by 1 cell with some probability.
 * High-control pitchers (≥70) always hit their target.
 */
export function resolvePitchLanding(
  aim: ZoneCell,
  pitcher: Player,
  rng: RandomProvider
): ZoneCell {
  const stats = calculatePlayerStatsWithEquipment(pitcher) as PitcherStats;
  const control = stats.control ?? 50;

  if (control >= 70) return aim;

  const missProbability = (70 - control) / 100; // e.g. control=50 → 20% miss
  if (rng.random() > missProbability) return aim;

  // Miss: shift one cell in a random adjacent direction (clamp to grid)
  const offset = ADJACENT_OFFSETS[Math.floor(rng.random() * ADJACENT_OFFSETS.length)];
  const newRow = Math.max(0, Math.min(2, aim.row + offset[0])) as ZoneRow;
  const newCol = Math.max(0, Math.min(2, aim.col + offset[1])) as ZoneCol;
  return { row: newRow, col: newCol };
}

// ─── Zone Modifier Calculation ────────────────────────────────────────────────

function zonesEqual(a: ZoneCell, b: ZoneCell): boolean {
  return a.row === b.row && a.col === b.col;
}

function isCorner(cell: ZoneCell): boolean {
  return (cell.row === 0 || cell.row === 2) && (cell.col === 0 || cell.col === 2);
}

/**
 * Batting zone modifier.
 * Player clicked `playerZone`, pitch actually landed at `landing`.
 * `zoneMap` is the current batter's hot/cold map.
 *
 * Natural 20 condition: player clicked exactly where pitch landed AND that
 * cell is not the batter's cold zone (reading a pitch to your own weakness
 * is still wrong — you got lucky, not skilled).
 *
 * Zone physics (based on landing location) are applied additively on top of
 * the read bonus/penalty.
 */
export function calcBattingZoneModifier(
  playerZone: ZoneCell,
  landing: ZoneCell,
  zoneMap: ZoneMap
): ZoneModifier {
  const correctRead = zonesEqual(playerZone, landing);
  const landingZoneType = zoneMap[landing.row][landing.col];
  const clickedZoneType = zoneMap[playerZone.row][playerZone.col];

  const isPerfect = correctRead && clickedZoneType !== "cold";

  if (isPerfect) {
    return applyPhysics(
      { strikeoutBonus: -6, hitBonus: 10, homerunBonus: 8, walkBonus: 0, isPerfect: true },
      landing
    );
  }

  if (correctRead) {
    const hotBonus = landingZoneType === "hot" ? 4 : 0;
    return applyPhysics(
      { strikeoutBonus: -3, hitBonus: 8 + hotBonus, homerunBonus: hotBonus, walkBonus: 0, isPerfect: false },
      landing
    );
  }

  // Wrong read — swinging in the wrong zone
  return applyPhysics(
    { strikeoutBonus: 4, hitBonus: -5, homerunBonus: -3, walkBonus: 0, isPerfect: false },
    landing
  );
}

/**
 * Pitching zone modifier.
 * Player aimed at `aimZone`, pitch landed at `landing` (may differ due to control).
 * `zoneMap` is the BATTER's hot/cold map — pitcher wants to hit cold zones.
 *
 * Natural 20 condition: pitch lands in the batter's cold zone AND that cell
 * is a corner (most difficult spot).
 *
 * Zone physics (based on landing location) are applied additively. This means
 * cold corners have distinct risk profiles: HI-IN cold corner has high K ceiling
 * but dangerous HR physics if connected, while LO-OUT cold corner is safer.
 */
export function calcPitchingZoneModifier(
  aimZone: ZoneCell,
  landing: ZoneCell,
  zoneMap: ZoneMap
): ZoneModifier {
  const landingZoneType = zoneMap[landing.row][landing.col];
  const hitColdCorner = landingZoneType === "cold" && isCorner(landing);

  if (hitColdCorner) {
    return applyPhysics(
      { strikeoutBonus: 8, hitBonus: -8, homerunBonus: -6, walkBonus: -2, isPerfect: true },
      landing
    );
  }

  if (landingZoneType === "cold") {
    return applyPhysics(
      { strikeoutBonus: 5, hitBonus: -5, homerunBonus: -4, walkBonus: 0, isPerfect: false },
      landing
    );
  }

  if (landingZoneType === "hot") {
    return applyPhysics(
      { strikeoutBonus: -4, hitBonus: 5, homerunBonus: 6, walkBonus: 0, isPerfect: false },
      landing
    );
  }

  // Neutral zone — physics still apply (MID-MID is the easiest zone for batters)
  return applyPhysics(
    { strikeoutBonus: 0, hitBonus: 0, homerunBonus: 0, walkBonus: 0, isPerfect: false },
    landing
  );

  // Suppress unused param warning — aimZone is used by callers for display
  void aimZone;
}

// ─── Approach / Strategy Inference (deprecated) ───────────────────────────────

/**
 * @deprecated Approach selection is now explicit via ActionBar buttons.
 * Kept for backwards-compatibility; no longer called in normal game flow.
 */
export function inferApproachFromZone(zone: ZoneCell): BatterApproach {
  if (zone.row === 0) return "power";
  if (zone.row === 2) return "patient";
  return "contact";
}

/**
 * @deprecated Strategy selection is now explicit via ActionBar buttons.
 * Kept for backwards-compatibility; no longer called in normal game flow.
 */
export function inferStrategyFromZone(zone: ZoneCell): PitchStrategy {
  if (zone.row === 0) return "challenge";
  if (zone.row === 2) return "paint";
  return "finesse";
}

// ─── Execution Note Helper ────────────────────────────────────────────────────

/**
 * Returns a short note for low-control pitchers to warn of execution variance.
 * Returns null for pitchers with adequate control.
 */
export function getExecutionNote(pitcher: Player): string | null {
  const stats = calculatePlayerStatsWithEquipment(pitcher) as PitcherStats;
  const control = stats.control ?? 50;
  if (control >= 70) return null;
  const accuracy = Math.round(control + (70 - control) / 2); // rough display %
  return `${Math.round(accuracy)}% accuracy — may miss a zone`;
}
