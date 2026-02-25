// src/types/save.ts

import { Team, MatchResult } from "./game";
import { League, LeagueTier, CareerStats } from "./league";

export interface MatchLogEntry extends MatchResult {
  timestamp: number;
  opponent?: string; // Opponent team name
}

export interface SaveData {
  // Metadata
  version: string;
  timestamp: number;
  gameVersion: string;

  // Game State (matches Zustand store structure)
  state: {
    team: Team | null;
    matchLog: MatchLogEntry[];
    league: League | null;
    currentTier: LeagueTier;
    career: CareerStats;
  };

  // Future extensibility
  metadata?: {
    playtime?: number;
    achievements?: string[];
  };
}

// Type guard
export function isSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false;

  const save = data as Partial<SaveData>;

  return (
    typeof save.version === 'string' &&
    typeof save.timestamp === 'number' &&
    typeof save.gameVersion === 'string' &&
    typeof save.state === 'object' &&
    save.state !== null
  );
}
