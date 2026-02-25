import { Team, MatchResult } from "./game";

/**
 * League tiers matching brainstorm.md vision
 * Players progress through tiers via promotion/relegation
 */
export type LeagueTier = "SANDLOT" | "LOCAL" | "REGIONAL" | "NATIONAL" | "WORLD";

/**
 * AI decision-making personality for roster management
 * Creates variation in how AI teams handle fatigue and rotation
 */
export interface AIPersonality {
  aggression: number; // 0-1: How willing to play tired players (risk/reward)
  depthFocus: number; // 0-1: Preference for deep bench vs star players
  restDiscipline: number; // 0-1: How strictly they follow rest thresholds
}

/**
 * Extended team interface for AI opponents
 * Reuses existing Team structure but adds AI-specific metadata
 */
export interface OpponentTeam extends Team {
  id: string; // Unique identifier for persistence
  name: string; // Team name (e.g., "New York Yankees")
  city: string; // City name (e.g., "New York")
  mascot: string; // Mascot (e.g., "Yankees")
  tier: LeagueTier; // Current tier of this team
  aiPersonality: AIPersonality; // Behavioral traits for rotation decisions
  colors: {
    // Visual identity
    primary: string;
    secondary: string;
  };
}

/**
 * Match scheduling system
 */
export interface MatchSchedule {
  weeks: Week[];
}

export interface Week {
  weekNumber: number;
  matches: ScheduledMatch[];
}

export interface ScheduledMatch {
  homeTeamId: string;
  awayTeamId: string;
  completed: boolean;
  result?: MatchResult; // Stored after match completes
}

/**
 * League standings entry
 */
export interface StandingsEntry {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  runsScored: number; // Tiebreaker
  runsAllowed: number; // Tiebreaker
  streak: number; // Current win/loss streak (positive = wins)
}

/**
 * League structure - single active league at a time
 */
export interface League {
  id: string;
  tier: LeagueTier;
  season: number; // Season number in career
  teams: OpponentTeam[]; // All teams including player team
  humanTeamId: string; // Reference to player's team

  schedule: MatchSchedule;
  standings: StandingsEntry[];

  currentWeek: number;
  totalWeeks: number;

  // Progression tracking
  isComplete: boolean;
  seasonResult?: SeasonResult; // Set when season ends
}

/**
 * Promotion/relegation results
 */
export interface SeasonResult {
  finalPosition: number;
  totalWins: number;
  totalLosses: number;

  // Rewards
  cashPrize: number;
  scoutPoints: number;
  fanBonus: number;

  // Progression
  promoted: boolean;
  relegated: boolean;
  nextTier?: LeagueTier;
}

/**
 * Career statistics (persistent across seasons)
 */
export interface CareerStats {
  totalSeasons: number;
  totalWins: number;
  totalLosses: number;

  championshipsWon: number;
  tournamentsWon: number;

  highestTierReached: LeagueTier;

  // Hall of Fame tracking (store championship games only)
  historicalRecords: HistoricalRecord[];
}

/**
 * Historical record for stat leaders
 * Store only championship games for now, expand later
 */
export interface HistoricalRecord {
  season: number;
  tier: LeagueTier;
  eventType: "CHAMPIONSHIP" | "TOURNAMENT_FINAL" | "PLAYOFF";

  result: MatchResult;

  // Key stats from the match
  mvpPlayer?: {
    playerId: string;
    name: string;
    statLine: string; // "3-4, 2 HR, 5 RBI" or "7 IP, 10 K, 1 ER"
  };
}

/**
 * Tournament bracket structure (for future tournaments)
 */
export interface Tournament {
  id: string;
  name: string;
  rounds: TournamentRound[];
  currentRound: number;
  isComplete: boolean;
}

export interface TournamentRound {
  roundNumber: number;
  name: string; // "Finals", "Semifinals", etc.
  matches: ScheduledMatch[];
}
