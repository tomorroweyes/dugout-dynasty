import type { EquippedItems, LootDrop } from "./item";
import type {
  PlayerClass,
  SpiritResource,
  PlayerAbility, // Re-exported below
} from "./ability";
import type { BatterApproach, PitchStrategy } from "./approach";
import type { GameTraceLog } from "./trace";

// Re-export PlayerAbility for external use
export type { PlayerAbility } from "./ability";

// Player Traits - permanent personality tags for the synergy system
export type PlayerTrait = "Muscle" | "Grit" | "Flash" | "Eye" | "Glue" | "Fire" | "Ice" | "Wile" | "Heart" | "Brain";

export interface BatterStats {
  power: number; // PWR - Home run/extra base hitting power
  contact: number; // CON - Ability to get on base, hit singles
  glove: number; // GLV - Fielding defense
  speed: number; // SPD - Baserunning speed, extra base taking
}

export interface PitcherStats {
  velocity: number; // VEL - Fastball speed/strikeout power
  control: number; // CTL - Strike accuracy/walk prevention
  break: number; // BRK - Breaking ball movement/deception
}

export type PlayerStats = BatterStats | PitcherStats;

// Season and career stat tracking for individual players
export interface BatterSeasonStats {
  gamesPlayed: number;
  atBats: number;
  hits: number;
  runs: number;
  rbis: number;
  strikeouts: number;
  walks: number;
  doubles: number;
  triples: number;
  homeRuns: number;
}

export interface PitcherSeasonStats {
  gamesPlayed: number;
  inningsPitched: number;
  hitsAllowed: number;
  runsAllowed: number;
  strikeouts: number;
  walks: number;
  homeRunsAllowed: number;
}

export type BatterCareerStats = BatterSeasonStats;
export type PitcherCareerStats = PitcherSeasonStats;

export interface Player {
  id: string;
  name: string;
  surname: string; // Last name only, for compact displays
  role: "Batter" | "Starter" | "Reliever";
  stats: PlayerStats;
  salary: number;
  // XP & Leveling (Phase 1)
  level: number;
  xp: number;
  totalXpEarned: number; // Lifetime XP for career tracking
  // Equipment (Phase 2)
  equipment: EquippedItems;
  // Abilities & Spirit (Phase 4)
  class?: PlayerClass; // Chosen at level 5, undefined until then
  spirit: SpiritResource; // Current/max spirit for abilities
  abilities: PlayerAbility[]; // Unlocked/upgraded abilities (also called techniques)
  skillPoints: number; // Unspent skill points
  // Technique System
  maxTechniqueSlots?: number; // Max technique slots (default: 5 + level/10)
  // Traits (Synergy System) - permanent personality tags assigned at generation
  traits: PlayerTrait[];
  // Season and career stat tracking (optional for backwards compatibility)
  seasonStats?: BatterSeasonStats | PitcherSeasonStats;
  careerStats?: BatterCareerStats | PitcherCareerStats;
}

// Type guards
export function isBatter(
  player: Player
): player is Player & { stats: BatterStats } {
  return player.role === "Batter";
}

export function isPitcher(
  player: Player
): player is Player & { stats: PitcherStats } {
  return player.role === "Starter" || player.role === "Reliever";
}

export interface Team {
  id?: string; // Optional for backwards compatibility, required for league play
  cash: number;
  fans: number;
  roster: Player[];
  lineup: string[];
  wins: number;
  losses: number;
  colors?: {
    primary: string;
    secondary: string;
  };
}

export interface PlayerBoxScore {
  playerId: string;
  name: string;
  atBats: number;
  hits: number;
  runs: number;
  rbis: number;
  strikeouts: number;
  walks: number;
  // Detailed hit tracking for XP calculation
  doubles?: number;
  triples?: number;
  homeRuns?: number;
}

export interface PitcherBoxScore {
  playerId: string;
  name: string;
  inningsPitched: number;
  hitsAllowed: number;
  runsAllowed: number;
  strikeouts: number;
  walks: number;
  // Detailed tracking for XP calculation
  homeRunsAllowed?: number;
}

export type PlayOutcome =
  | "strikeout"
  | "walk"
  | "single"
  | "double"
  | "triple"
  | "homerun"
  | "groundout"
  | "flyout"
  | "lineout"
  | "popout"
  | "out";

// Alias for at-bat outcomes (same as PlayOutcome)
export type AtBatOutcome = PlayOutcome;

export interface PlayByPlayEvent {
  inning: number;
  isTop: boolean; // true = top (away team batting / opponent in match context), false = bottom (home team batting / my team in match context)
  batter: string;
  pitcher: string;
  outcome: PlayOutcome;
  rbi?: number;
  outs: number;
  narrativeText?: string; // Phase 3: Dynamic narrative description
  batterApproach?: BatterApproach;
  pitchStrategy?: PitchStrategy;
  batterAbilityUsed?: boolean;
  pitcherAbilityUsed?: boolean;
  perfectContact?: boolean; // batting natural 20 — zone read + hot zone alignment
  paintedCorner?: boolean;  // pitching natural 20 — cold corner perfectly located
}

export interface BoxScore {
  myBatters: PlayerBoxScore[];
  myPitchers: PitcherBoxScore[];
  opponentBatters: PlayerBoxScore[];
  opponentPitchers: PitcherBoxScore[];
  myHits: number;
  opponentHits: number;
}

export interface DraftSlot {
  role: "Batter" | "Starter" | "Reliever";
  candidates: Player[];
}

export interface DraftState {
  fromTier: import("./league").LeagueTier;
  toTier: import("./league").LeagueTier;
  slots: DraftSlot[];
  picks: Player[];
  currentSlotIndex: number;
}

export interface MatchResult {
  myRuns: number;
  opponentRuns: number;
  isWin: boolean;
  cashEarned: number;
  totalInnings: number;
  boxScore?: BoxScore;
  playByPlay?: PlayByPlayEvent[];
  lootDrops?: LootDrop[]; // Equipment drops from match (Phase 2)
  myTeamColor?: string; // Primary color for avatar generation
  opponentTeamColor?: string; // Primary color for avatar generation
  traceLog?: GameTraceLog; // Engine trace log (when enabled in settings)
}
