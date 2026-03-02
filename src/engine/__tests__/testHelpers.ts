/**
 * Shared test helpers for creating type-safe mock players and teams.
 * Reduces boilerplate across test files and ensures all required
 * Player fields are present when the type evolves.
 */

import type { Player, Team } from "@/types/game";
import type { BatterStats, PitcherStats } from "@/types/game";
import type { SpiritResource } from "@/types/ability";

export const DEFAULT_SPIRIT: SpiritResource = { current: 50, max: 50 };

export const DEFAULT_EQUIPMENT = {
  bat: null,
  glove: null,
  cap: null,
  cleats: null,
  accessory: null,
} as const;

/** Create a minimal valid batter for tests */
export function mockBatter(overrides: Partial<Player> & {
  stats?: Partial<BatterStats>
} = {}): Player {
  const { stats: statsOverride, ...rest } = overrides;
  return {
    id: "batter-1",
    name: "Test",
    surname: "Batter",
    role: "Batter",
    stats: {
      power: 50,
      contact: 50,
      glove: 50,
      speed: 50,
      ...statsOverride,
    },
    salary: 100,
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    equipment: { ...DEFAULT_EQUIPMENT },
    spirit: { ...DEFAULT_SPIRIT },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...rest,
  };
}

/** Create a minimal valid starter pitcher for tests */
export function mockPitcher(overrides: Partial<Player> & {
  stats?: Partial<PitcherStats>
} = {}): Player {
  const { stats: statsOverride, ...rest } = overrides;
  return {
    id: "pitcher-1",
    name: "Test",
    surname: "Pitcher",
    role: "Starter",
    stats: {
      velocity: 60,
      control: 60,
      break: 60,
      ...statsOverride,
    },
    salary: 150,
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    equipment: { ...DEFAULT_EQUIPMENT },
    spirit: { ...DEFAULT_SPIRIT },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...rest,
  };
}

/** Create a minimal valid reliever for tests */
export function mockReliever(overrides: Partial<Player> & {
  stats?: Partial<PitcherStats>
} = {}): Player {
  return mockPitcher({ role: "Reliever", ...overrides });
}

/** Create a minimal valid Team for tests */
export function mockTeam(overrides: Partial<Team> = {}): Team {
  return {
    cash: 1000,
    fans: 100,
    roster: [],
    lineup: [],
    wins: 0,
    losses: 0,
    ...overrides,
  };
}
