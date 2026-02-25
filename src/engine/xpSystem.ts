/**
 * XP System - Core calculation engine
 *
 * Responsibilities:
 * - Calculate XP earned from match events
 * - Process level-ups
 * - Apply stat bonuses on level-up
 */

import type { Player, PlayerBoxScore, PitcherBoxScore } from "../types/game";
import {
  calculateXpToNextLevel,
  BATTER_XP_REWARDS,
  PITCHER_XP_REWARDS,
  MATCH_XP_REWARDS,
  LEVEL_UP_STAT_BONUSES,
  LEVEL_CONSTANTS,
} from "./xpConfig";

// ============================================
// TYPES
// ============================================

export interface XpGain {
  playerId: string;
  xpEarned: number;
  breakdown: XpBreakdown;
}

export interface XpBreakdown {
  fromHits: number;
  fromWalks: number;
  fromRbis: number;
  fromRuns: number;
  fromPitching: number;
  fromMatchResult: number;
  fromParticipation: number;
}

export interface LevelUpResult {
  playerId: string;
  playerName: string;
  previousLevel: number;
  newLevel: number;
  statBonuses: StatBonus[];
}

export interface StatBonus {
  stat: string;
  increase: number;
}

// ============================================
// XP CALCULATION - BATTERS
// ============================================

/**
 * Calculate XP earned by a batter from their box score.
 */
export function calculateBatterXp(boxScore: PlayerBoxScore): number {
  let xp = 0;

  // Hits by type
  // Note: boxScore.hits is total hits, we need to break down by type
  // Singles = hits - doubles - triples - homeRuns (clamped to 0 to guard against stale boxScore data)
  const singles = Math.max(
    0,
    boxScore.hits -
      (boxScore.doubles || 0) -
      (boxScore.triples || 0) -
      (boxScore.homeRuns || 0)
  );

  xp += singles * BATTER_XP_REWARDS.SINGLE;
  xp += (boxScore.doubles || 0) * BATTER_XP_REWARDS.DOUBLE;
  xp += (boxScore.triples || 0) * BATTER_XP_REWARDS.TRIPLE;
  xp += (boxScore.homeRuns || 0) * BATTER_XP_REWARDS.HOME_RUN;

  // Walks
  xp += (boxScore.walks || 0) * BATTER_XP_REWARDS.WALK;

  // RBI bonus
  xp += (boxScore.rbis || 0) * BATTER_XP_REWARDS.RBI_BONUS;

  // Runs scored
  xp += (boxScore.runs || 0) * BATTER_XP_REWARDS.RUN_SCORED;

  return xp;
}

/**
 * Create a detailed XP breakdown for a batter.
 */
export function createBatterXpBreakdown(boxScore: PlayerBoxScore): XpBreakdown {
  const singles = Math.max(
    0,
    boxScore.hits -
      (boxScore.doubles || 0) -
      (boxScore.triples || 0) -
      (boxScore.homeRuns || 0)
  );

  const fromHits =
    singles * BATTER_XP_REWARDS.SINGLE +
    (boxScore.doubles || 0) * BATTER_XP_REWARDS.DOUBLE +
    (boxScore.triples || 0) * BATTER_XP_REWARDS.TRIPLE +
    (boxScore.homeRuns || 0) * BATTER_XP_REWARDS.HOME_RUN;

  return {
    fromHits,
    fromWalks: (boxScore.walks || 0) * BATTER_XP_REWARDS.WALK,
    fromRbis: (boxScore.rbis || 0) * BATTER_XP_REWARDS.RBI_BONUS,
    fromRuns: (boxScore.runs || 0) * BATTER_XP_REWARDS.RUN_SCORED,
    fromPitching: 0,
    fromMatchResult: 0,
    fromParticipation: 0,
  };
}

// ============================================
// XP CALCULATION - PITCHERS
// ============================================

/**
 * Calculate XP earned by a pitcher from their box score.
 */
export function calculatePitcherXp(boxScore: PitcherBoxScore): number {
  let xp = 0;

  // Innings pitched (fractional innings count proportionally)
  xp += boxScore.inningsPitched * PITCHER_XP_REWARDS.INNING_PITCHED;

  // Strikeouts
  xp += boxScore.strikeouts * PITCHER_XP_REWARDS.STRIKEOUT;

  // Penalties
  xp += (boxScore.walks || 0) * PITCHER_XP_REWARDS.WALK_PENALTY;
  xp += boxScore.hitsAllowed * PITCHER_XP_REWARDS.HIT_ALLOWED_PENALTY;
  xp += boxScore.runsAllowed * PITCHER_XP_REWARDS.RUN_ALLOWED_PENALTY;
  xp +=
    (boxScore.homeRunsAllowed || 0) * PITCHER_XP_REWARDS.HOME_RUN_ALLOWED_PENALTY;

  // Don't let XP go negative from penalties
  return Math.max(0, xp);
}

/**
 * Create a detailed XP breakdown for a pitcher.
 */
export function createPitcherXpBreakdown(
  boxScore: PitcherBoxScore
): XpBreakdown {
  const pitchingXp =
    boxScore.inningsPitched * PITCHER_XP_REWARDS.INNING_PITCHED +
    boxScore.strikeouts * PITCHER_XP_REWARDS.STRIKEOUT +
    (boxScore.walks || 0) * PITCHER_XP_REWARDS.WALK_PENALTY +
    boxScore.hitsAllowed * PITCHER_XP_REWARDS.HIT_ALLOWED_PENALTY +
    boxScore.runsAllowed * PITCHER_XP_REWARDS.RUN_ALLOWED_PENALTY +
    (boxScore.homeRunsAllowed || 0) *
      PITCHER_XP_REWARDS.HOME_RUN_ALLOWED_PENALTY;

  return {
    fromHits: 0,
    fromWalks: 0,
    fromRbis: 0,
    fromRuns: 0,
    fromPitching: Math.max(0, pitchingXp),
    fromMatchResult: 0,
    fromParticipation: 0,
  };
}

// ============================================
// MATCH-LEVEL XP CALCULATION
// ============================================

/**
 * Calculate all XP gains for a completed match.
 *
 * @param boxScores - Batter box scores from match
 * @param pitcherBoxScores - Pitcher box scores from match
 * @param isWin - Whether the team won
 * @param lineup - Player IDs that were in the lineup
 * @param bench - Player IDs on the bench (get reduced XP)
 */
export function calculateMatchXp(
  boxScores: PlayerBoxScore[],
  pitcherBoxScores: PitcherBoxScore[],
  isWin: boolean,
  lineup: string[],
  bench: string[] = []
): XpGain[] {
  const xpGains: XpGain[] = [];

  // Process batters
  for (const boxScore of boxScores) {
    const breakdown = createBatterXpBreakdown(boxScore);

    // Add match result bonus
    breakdown.fromMatchResult = isWin
      ? MATCH_XP_REWARDS.WIN_BONUS
      : MATCH_XP_REWARDS.LOSS_CONSOLATION;

    // Add participation bonus (lineup players only)
    if (lineup.includes(boxScore.playerId)) {
      breakdown.fromParticipation = MATCH_XP_REWARDS.PARTICIPATION_BONUS;
    }

    const totalXp =
      breakdown.fromHits +
      breakdown.fromWalks +
      breakdown.fromRbis +
      breakdown.fromRuns +
      breakdown.fromMatchResult +
      breakdown.fromParticipation;

    xpGains.push({
      playerId: boxScore.playerId,
      xpEarned: totalXp,
      breakdown,
    });
  }

  // Process pitchers
  for (const boxScore of pitcherBoxScores) {
    const breakdown = createPitcherXpBreakdown(boxScore);

    // Add match result bonus
    breakdown.fromMatchResult = isWin
      ? MATCH_XP_REWARDS.WIN_BONUS
      : MATCH_XP_REWARDS.LOSS_CONSOLATION;

    // Add participation bonus
    breakdown.fromParticipation = MATCH_XP_REWARDS.PARTICIPATION_BONUS;

    const totalXp =
      breakdown.fromPitching +
      breakdown.fromMatchResult +
      breakdown.fromParticipation;

    xpGains.push({
      playerId: boxScore.playerId,
      xpEarned: totalXp,
      breakdown,
    });
  }

  // Process bench players (reduced XP for being on the team)
  for (const playerId of bench) {
    const matchBonus = isWin
      ? MATCH_XP_REWARDS.WIN_BONUS
      : MATCH_XP_REWARDS.LOSS_CONSOLATION;
    const benchXp = Math.floor(matchBonus * MATCH_XP_REWARDS.BENCH_MULTIPLIER);

    xpGains.push({
      playerId,
      xpEarned: benchXp,
      breakdown: {
        fromHits: 0,
        fromWalks: 0,
        fromRbis: 0,
        fromRuns: 0,
        fromPitching: 0,
        fromMatchResult: benchXp,
        fromParticipation: 0,
      },
    });
  }

  return xpGains;
}

// ============================================
// LEVEL-UP PROCESSING
// ============================================

/**
 * Apply XP to a player and process any level-ups.
 *
 * Returns the updated player and any level-up results.
 */
export function applyXpToPlayer(
  player: Player,
  xpToAdd: number
): { updatedPlayer: Player; levelUps: LevelUpResult[] } {
  const levelUps: LevelUpResult[] = [];

  let currentLevel = player.level;
  let currentXp = player.xp + xpToAdd;
  let totalXpEarned = player.totalXpEarned + xpToAdd;

  // Process level-ups (could be multiple if big XP gain)
  while (currentLevel < LEVEL_CONSTANTS.MAX_LEVEL) {
    const xpNeeded = calculateXpToNextLevel(currentLevel);

    if (currentXp >= xpNeeded) {
      // Level up!
      currentXp -= xpNeeded;
      const previousLevel = currentLevel;
      currentLevel += 1;

      // Calculate stat bonuses
      const statBonuses = calculateLevelUpStatBonuses(player.role);

      levelUps.push({
        playerId: player.id,
        playerName: player.name,
        previousLevel,
        newLevel: currentLevel,
        statBonuses,
      });
    } else {
      break;
    }
  }

  // Apply stat bonuses from level-ups
  let updatedStats = { ...player.stats };
  for (const levelUp of levelUps) {
    updatedStats = applyStatBonuses(updatedStats, levelUp.statBonuses, player.role);
  }

  const updatedPlayer: Player = {
    ...player,
    level: currentLevel,
    xp: currentXp,
    totalXpEarned,
    stats: updatedStats,
  };

  return { updatedPlayer, levelUps };
}

/**
 * Calculate stat bonuses for a level-up based on player role.
 */
function calculateLevelUpStatBonuses(role: Player["role"]): StatBonus[] {
  const bonusConfig = LEVEL_UP_STAT_BONUSES[role];

  return Object.entries(bonusConfig).map(([stat, increase]) => ({
    stat,
    increase,
  }));
}

/**
 * Apply stat bonuses to player stats.
 */
function applyStatBonuses(
  stats: Player["stats"],
  bonuses: StatBonus[],
  _role: Player["role"]
): Player["stats"] {
  const newStats = { ...stats };

  for (const bonus of bonuses) {
    const statKey = bonus.stat as keyof typeof newStats;
    if (statKey in newStats) {
      // Apply bonus and cap at 100
      (newStats as Record<string, number>)[statKey] = Math.min(
        100,
        (newStats as Record<string, number>)[statKey] + bonus.increase
      );
    }
  }

  return newStats;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get XP progress as a percentage (0-100).
 */
export function getXpProgressPercent(player: Player): number {
  if (player.level >= LEVEL_CONSTANTS.MAX_LEVEL) {
    return 100;
  }
  const xpNeeded = calculateXpToNextLevel(player.level);
  return Math.floor((player.xp / xpNeeded) * 100);
}

/**
 * Get XP needed for the player's next level.
 */
export function getXpToNextLevel(player: Player): number {
  return calculateXpToNextLevel(player.level);
}

/**
 * Check if a player is at max level.
 */
export function isMaxLevel(player: Player): boolean {
  return player.level >= LEVEL_CONSTANTS.MAX_LEVEL;
}

/**
 * Initialize XP fields for a new player.
 */
export function initializePlayerXp(
  player: Omit<Player, "level" | "xp" | "totalXpEarned">
): Player {
  return {
    ...player,
    level: LEVEL_CONSTANTS.STARTING_LEVEL,
    xp: LEVEL_CONSTANTS.STARTING_XP,
    totalXpEarned: LEVEL_CONSTANTS.STARTING_XP,
  };
}
