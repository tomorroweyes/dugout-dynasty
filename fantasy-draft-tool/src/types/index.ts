/**
 * Data Types — shared across all layers
 * NO business logic, pure data structures
 */

export type Position =
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "OF"
  | "DH"
  | "SP"
  | "RP";
export type PlayerType = "batter" | "pitcher";
export type Tier = "ELITE" | "1" | "2" | "3" | "4" | "5";

export type StrategyPhase = "early" | "middle" | "late" | "all";

export interface BattingStats {
  pa: number;
  h: number;
  r: number;
  hr: number;
  rbi: number;
  sb: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingStats {
  pa: number;
  ip?: number;
  k: number;
  kpct: number;
  bbpct: number;
  era: number;
  whip: number;
  qs?: number;
  svhd?: number;
}

export interface Player {
  id: string;
  name: string;
  mlbId?: number;
  type: PlayerType;
  position: Position;
  positions?: Position[]; // eligible positions
  tier: Tier;

  // Stats from 2025 season
  batting?: BattingStats;
  pitching?: PitchingStats;

  // Multi-year stats
  previousSeasons?: { season: number; batting?: BattingStats; pitching?: PitchingStats }[];

  // 2026 projections
  projections?: { batting?: BattingStats; pitching?: PitchingStats; source: string };

  // Age (as of current season)
  age?: number;

  // Market data
  adp?: number;
  ownership?: number; // percentage
  expertRank?: number; // external consensus rank (top 75)

  // Health & status
  injured: boolean;
  injuryStatus?: string; // e.g., "DAY_TO_DAY", "OUT_60_DAYS"
  notes?: string[]; // injury/roster/news notes

  // Meta
  lastUpdated: number; // unix timestamp
}

export interface LeagueConfig {
  name: string;
  teams: number;
  format: "H2H" | "ROTO";
  scoringType: "most-categories" | "points";

  roster: {
    batting: string;
    pitching: string;
    bench: number;
    il: number;
  };

  scoringCategories: {
    batting: string[];
    pitching: string[];
  };

  draftInfo: {
    pickNumber: number; // user's first pick (1-indexed)
    totalPicks: number; // total picks in draft (teams * rounds)
    snakeDraft: boolean;
  };
}

export interface DraftData {
  league: LeagueConfig;
  players: Player[];
  fetchedAt: number;
  dataVersion: string;
}

export interface StrategyPillar {
  title: string;
  detail: string;
  phase: StrategyPhase;
}

export interface HistoricalSeason {
  year: number;
  finish: string;
  summary: string;
  strengths: string[];
  misses: string[];
}

export interface RosterSlot {
  id: string;
  label: string;
  type: PlayerType;
}

export interface LeagueProfile {
  owner: string;
  leagueName: string;
  draftPerspective: string;
  goals: string[];
  strategyPillars: StrategyPillar[];
  historicalSeasons: HistoricalSeason[];
  historyPrompt: string;
  watchCategories: string[];
  dataWarnings: string[];
  rosterSlots: RosterSlot[];
}

export interface EspnLeagueTeam {
  id: number;
  abbrev?: string;
  location?: string;
  nickname?: string;
  primaryOwner?: string;
}

export interface EspnDraftDetail {
  drafted: boolean | null;
  inProgress: boolean | null;
  completeDate: number | null;
  pickOrder: number[] | null;
  type: string | null;
}

export interface EspnLeagueSummary {
  id: number;
  season: number;
  name: string | null;
  status: Record<string, unknown> | null;
  scoringType: string | null;
  draftDetail: EspnDraftDetail;
  teams: EspnLeagueTeam[];
}

export interface EspnDraftPick {
  overallPickNumber: number;
  roundId: number;
  roundPickNumber: number;
  teamId: number;
  playerId: number;
  autoDraftTypeId: number;
  lineupSlotId: number;
}

export interface EspnAvailablePlayer {
  id: number;
  fullName: string;
  defaultPositionId: number | null;
  eligibleSlots: number[];
  proTeamId: number | null;
  onTeamId: number;
  status: string | null;
  lineupLocked: boolean;
  injuryStatus: string | null;
  percentOwned: number | null;
  averageDraftPosition: number | null;
  totalRanking: number | null;
  positionalRanking: number | null;
  totalRating: number | null;
}

export interface DraftedRecord {
  playerId: string;
  slotId: string | null;
}

export interface TakenRecord {
  playerId: string;
  takenAtPick: number;
}

export interface AutoRunBatch {
  triggerPlayerId: string;
  startPick: number;
  endPick: number;
  taken: TakenRecord[];
  removedQueueIds: string[];
}

export interface NeedCard {
  title: string;
  value: string;
  detail: string;
  tone: "urgent" | "watch" | "stable";
}

export interface EspnAutoPickApproximationEntry {
  rank: number;
  playerId: number;
  name: string;
  totalRanking: number | null;
  averageDraftPosition: number | null;
  onTeamId: number;
  injuryStatus: string | null;
}

export interface EspnLeagueData {
  fetchedAt: number;
  source: string;
  note: string;
  league: EspnLeagueSummary;
  draftPicks: EspnDraftPick[];
  availablePlayers: EspnAvailablePlayer[];
  autoPickApproximation: EspnAutoPickApproximationEntry[];
}
