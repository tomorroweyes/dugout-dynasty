/**
 * Sim Harness - Team Factory
 *
 * Builds named archetype teams for headless simulation.
 * Teams are deterministic when given a seed, so results are reproducible.
 *
 * HOW TO TWEAK:
 * - Adjust stat values in ARCHETYPES below to test balance hypotheses
 * - Add new archetypes to probe specific matchups
 * - Change ROSTER_SIZE to scale team depth testing
 */

import type { Player, Team } from "@/types/game";
import type { BatterStats, PitcherStats } from "@/types/game";
import { SeededRandomProvider } from "@/engine/randomProvider";
import { generatePlayer } from "@/engine/playerGenerator";
import { assignArchetypeAndAbilities } from "@/engine/playerGenerator";

const ROSTER_SIZE = { batters: 9, starters: 1, relievers: 2 };

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build a Player from explicit stats (bypasses random generation).
 * Use this when you want precise control over stat values for testing.
 */
export function makeBatter(
  name: string,
  stats: BatterStats,
  rng = new SeededRandomProvider(0)
): Player {
  const base = generatePlayer("Batter", "SOLID", rng);
  return {
    ...base,
    id: makeId(),
    name,
    stats,
  };
}

export function makePitcher(
  name: string,
  role: "Starter" | "Reliever",
  stats: PitcherStats,
  rng = new SeededRandomProvider(0)
): Player {
  const base = generatePlayer(role, "SOLID", rng);
  return {
    ...base,
    id: makeId(),
    name,
    role,
    stats,
  };
}

/**
 * Archetype definitions — tweak these to test balance hypotheses.
 *
 * Stat ranges: 1-99 (see statConfig.ts for tier reference)
 * ROOKIE: 20-45, SOLID: 45-60, GOOD: 60-75, STAR: 75-87, ELITE: 87-100
 */
export const ARCHETYPES = {
  POWER: {
    label: "Power",
    emoji: "💥",
    description: "Sluggers: high power, moderate contact. Swings for the fences.",
    batter: { power: 72, contact: 48, glove: 50, speed: 40 } as BatterStats,  // power 78→72 (was dominating)
    starter: { velocity: 72, control: 52, break: 48 } as PitcherStats,
    reliever: { velocity: 70, control: 50, break: 50 } as PitcherStats,
  },
  CONTACT: {
    label: "Contact",
    emoji: "🎯",
    description: "High contact, low power. Consistent ball-in-play team.",
    batter: { power: 42, contact: 78, glove: 55, speed: 55 } as BatterStats,
    starter: { velocity: 48, control: 78, break: 52 } as PitcherStats,
    reliever: { velocity: 50, control: 75, break: 52 } as PitcherStats,
  },
  BALANCED: {
    label: "Balanced",
    emoji: "⚖️",
    description: "All-around team. Baseline reference for comparison.",
    batter: { power: 58, contact: 58, glove: 55, speed: 55 } as BatterStats,
    starter: { velocity: 58, control: 58, break: 58 } as PitcherStats,
    reliever: { velocity: 58, control: 56, break: 56 } as PitcherStats,
  },
  SPEED: {
    label: "Speed",
    emoji: "⚡",
    description: "Fast, disciplined hitters. Gap power, high on-base, small ball.",
    batter: { power: 38, contact: 72, glove: 58, speed: 82 } as BatterStats,
    starter: { velocity: 58, control: 62, break: 60 } as PitcherStats,
    reliever: { velocity: 55, control: 62, break: 60 } as PitcherStats,
  },
  PITCHING: {
    label: "Pitching",
    emoji: "⚾",
    description: "Elite pitching, below-average bats. Win 1-0, lose 0-5.",
    batter: { power: 45, contact: 50, glove: 55, speed: 48 } as BatterStats,
    starter: { velocity: 68, control: 78, break: 76 } as PitcherStats,  // Elite via control+break, not raw heat
    reliever: { velocity: 66, control: 75, break: 73 } as PitcherStats,
  },
  SLUGFEST: {
    label: "Slugfest",
    emoji: "🔥",
    description: "Power everywhere — batters AND pitchers throw heat.",
    batter: { power: 82, contact: 44, glove: 45, speed: 38 } as BatterStats,  // contact 40→44
    starter: { velocity: 74, control: 44, break: 42 } as PitcherStats,  // Hard but wild
    reliever: { velocity: 72, control: 44, break: 42 } as PitcherStats,
  },
} as const;

export type ArchetypeName = keyof typeof ARCHETYPES;

/**
 * Build a full Team from an archetype definition.
 * Deterministic when seed is fixed.
 */
export function buildTeam(archetype: ArchetypeName, seed = 42): Team {
  const def = ARCHETYPES[archetype];
  const rng = new SeededRandomProvider(seed);

  const roster: Player[] = [];

  // Batters
  for (let i = 0; i < ROSTER_SIZE.batters; i++) {
    roster.push(makeBatter(`${def.label} Batter ${i + 1}`, def.batter, rng));
  }

  // Starter
  roster.push(makePitcher(`${def.label} Starter`, "Starter", def.starter, rng));

  // Relievers
  for (let i = 0; i < ROSTER_SIZE.relievers; i++) {
    roster.push(
      makePitcher(`${def.label} Reliever ${i + 1}`, "Reliever", def.reliever, rng)
    );
  }

  // Lineup includes ALL players — simulateGame separates batters/pitchers internally by role
  const lineup = roster.map((p) => p.id);

  return {
    id: `team-${archetype}-${seed}`,
    cash: 0,
    fans: 1.0,
    roster,
    lineup,
    wins: 0,
    losses: 0,
  };
}

/**
 * Build a team using the real player generator (random archetypes, abilities, traits).
 * Better for testing ability/synergy interactions.
 */
export function buildRandomTeam(name: string, seed: number): Team {
  const rng = new SeededRandomProvider(seed);

  const roster: Player[] = [];

  for (let i = 0; i < ROSTER_SIZE.batters; i++) {
    const p = generatePlayer("Batter", "SOLID", rng);
    roster.push(assignArchetypeAndAbilities(p, 1, rng));
  }

  const starter = generatePlayer("Starter", "SOLID", rng);
  roster.push(assignArchetypeAndAbilities(starter, 1, rng));

  for (let i = 0; i < ROSTER_SIZE.relievers; i++) {
    const r = generatePlayer("Reliever", "SOLID", rng);
    roster.push(assignArchetypeAndAbilities(r, 0, rng));
  }

  // Lineup includes ALL players — simulateGame separates batters/pitchers internally by role
  const lineup = roster.map((p) => p.id);

  return {
    id: `team-${name}-${seed}`,
    cash: 0,
    fans: 1.0,
    roster,
    lineup,
    wins: 0,
    losses: 0,
  };
}
