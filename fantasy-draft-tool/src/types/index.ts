/**
 * Data Types — shared across all layers
 * NO business logic, pure data structures
 */

export type Position = 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF' | 'DH' | 'SP' | 'RP';
export type PlayerType = 'batter' | 'pitcher';
export type Tier = 'ELITE' | '1' | '2' | '3' | '4' | '5';

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
  
  // Market data
  adp?: number;
  ownership?: number; // percentage
  
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
  format: 'H2H' | 'ROTO';
  scoringType: 'most-categories' | 'points';
  
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
