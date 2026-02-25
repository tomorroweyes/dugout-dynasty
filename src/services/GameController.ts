/**
 * Game Controller Service Layer
 * Separates business logic from state management
 * Orchestrates game engine, events, and calculations
 */

import {
  Team,
  Player,
  MatchResult,
  isBatter,
  isPitcher,
  BatterStats,
  PitcherStats,
} from "@/types/game";
import { LeagueTier } from "@/types/league";
import { generateOpponentTeam, simulateMatch } from "@/engine/matchEngine";
import { generateStarterTeam } from "@/engine/playerGenerator";
import { getDefaultRandomProvider } from "@/engine/randomProvider";
import { GAME_CONSTANTS } from "@/engine/constants";
import { gameEvents } from "@/engine/gameEvents";
import { SeededRandom } from "@/utils/seededRandom";
import { calculateMatchXp, type XpGain } from "@/engine/xpSystem";

export interface TeamSetup {
  roster: Player[];
  lineup: string[];
}

export interface MatchSetup {
  opponentTeam: Team;
  seed?: number;
  enableTrace?: boolean;
  matchRewards?: { win: number; loss: number };
}

/**
 * Game Controller - handles all business logic for the game
 */
export class GameController {
  private rng: SeededRandom;

  constructor(seed?: number) {
    this.rng = seed !== undefined ? new SeededRandom(seed) : new SeededRandom();
  }

  /**
   * Generate a new team with proper roster organization
   * @param tier - League tier (determines roster size)
   */
  generateNewTeam(tier: LeagueTier = "SANDLOT"): TeamSetup {
    const roster = generateStarterTeam(getDefaultRandomProvider(), tier);

    // Organize roster by role for proper lineup assignment
    const batters = roster.filter((p) => p.role === "Batter");
    const starters = roster.filter((p) => p.role === "Starter");
    const relievers = roster.filter((p) => p.role === "Reliever");

    // Build lineup - cycle through available players to fill 9 batting spots
    // For small rosters (e.g., 4 batters), players bat multiple times per inning
    const batterLineup: string[] = [];
    for (let i = 0; i < GAME_CONSTANTS.LINEUP_COMPOSITION.BATTERS; i++) {
      const batter = batters[i % batters.length]; // Cycle through available batters
      if (batter) batterLineup.push(batter.id);
    }

    // Add pitchers to lineup (use all available, cycle if needed)
    const starterLineup: string[] = [];
    for (let i = 0; i < GAME_CONSTANTS.LINEUP_COMPOSITION.STARTERS; i++) {
      const starter = starters[i % Math.max(1, starters.length)];
      if (starter) starterLineup.push(starter.id);
    }

    const relieverLineup: string[] = [];
    for (let i = 0; i < GAME_CONSTANTS.LINEUP_COMPOSITION.RELIEVERS; i++) {
      const reliever = relievers[i % Math.max(1, relievers.length)];
      if (reliever) relieverLineup.push(reliever.id);
    }

    const lineup = [...batterLineup, ...starterLineup, ...relieverLineup];

    return { roster, lineup };
  }

  /**
   * Calculate team strength based on lineup stats
   */
  calculateTeamStrength(lineupPlayers: Player[]): number {
    if (lineupPlayers.length === 0) return 0;

    const totalStats = lineupPlayers.reduce((sum, p) => {
      if (isBatter(p)) {
        const stats = p.stats as BatterStats;
        return sum + stats.power + stats.contact + stats.glove + stats.speed;
      } else if (isPitcher(p)) {
        const stats = p.stats as PitcherStats;
        return sum + stats.velocity + stats.control + stats.break;
      }
      return sum;
    }, 0);

    return totalStats / lineupPlayers.length;
  }

  /**
   * Prepare a match by generating opponent
   */
  prepareMatch(team: Team): MatchSetup {
    const lineupPlayers = team.lineup
      .map((id) => team.roster.find((p) => p.id === id))
      .filter((p): p is Player => p !== undefined);

    const teamStrength = this.calculateTeamStrength(lineupPlayers);
    const opponentTeam = generateOpponentTeam(teamStrength);
    const seed = this.rng.getSeed();

    return { opponentTeam, seed };
  }

  /**
   * Play a match and return results with XP gains
   */
  playMatch(
    team: Team,
    matchSetup?: MatchSetup
  ): {
    result: MatchResult;
    xpGains: XpGain[];
  } {
    // Prepare match if not provided
    const setup = matchSetup || this.prepareMatch(team);

    // Emit match start event
    gameEvents.emit({ type: "match_start" });

    // Simulate the match (enableTrace and matchRewards passed from caller via matchSetup)
    const result = simulateMatch(team, setup.opponentTeam, setup.enableTrace, setup.matchRewards);

    // Calculate XP gains for all players
    const xpGains = result.boxScore
      ? calculateMatchXp(
          result.boxScore.myBatters,
          result.boxScore.myPitchers,
          result.isWin,
          team.lineup
        )
      : [];

    // Emit match end event
    gameEvents.emit({
      type: "match_end",
      isWin: result.isWin,
      cashEarned: result.cashEarned,
    });

    return { result, xpGains };
  }

  /**
   * Calculate if a player swap is valid
   */
  canSwapPlayer(team: Team, playerId: string, toLineup: boolean): boolean {
    const isInLineup = team.lineup.includes(playerId);

    if (toLineup && !isInLineup) {
      // Check if lineup is full
      return team.lineup.length < GAME_CONSTANTS.LINEUP_SIZE;
    }

    if (!toLineup && isInLineup) {
      // Always can remove from lineup
      return true;
    }

    return false;
  }

  /**
   * Toggle player in/out of lineup
   */
  swapPlayer(
    team: Team,
    playerId: string
  ): { lineup: string[] } | null {
    const isInLineup = team.lineup.includes(playerId);

    if (isInLineup) {
      // Remove from lineup
      return {
        lineup: team.lineup.filter((id) => id !== playerId),
      };
    } else {
      // Add to lineup (if space available)
      if (team.lineup.length < GAME_CONSTANTS.LINEUP_SIZE) {
        return {
          lineup: [...team.lineup, playerId],
        };
      }
    }

    return null;
  }

  /**
   * Calculate overall rating for a player based on their stats
   */
  private calculatePlayerRating(player: Player): number {
    if (isBatter(player)) {
      const stats = player.stats as BatterStats;
      return stats.power + stats.contact + stats.glove + stats.speed;
    } else if (isPitcher(player)) {
      const stats = player.stats as PitcherStats;
      return stats.velocity + stats.control + stats.break;
    }
    return 0;
  }

  /**
   * Calculate effective lineup value based on player quality
   */
  private calculateLineupValue(player: Player): number {
    return this.calculatePlayerRating(player);
  }

  /**
   * Auto-rotate pitchers after a match
   * No longer needed since stamina system was removed
   * Kept for backwards compatibility (returns null = no changes)
   */
  autoRotatePitchers(_team: Team): { lineup: string[] } | null {
    return null;
  }

  /**
   * Auto-fix lineup: Build the best possible lineup by player quality
   * Handles small rosters by cycling players to fill standard lineup positions
   */
  autoFix(team: Team): { lineup: string[] } | null {
    // Get all players by role
    const allBatters = team.roster.filter((p) => p.role === "Batter");
    const allStarters = team.roster.filter((p) => p.role === "Starter");
    const allRelievers = team.roster.filter((p) => p.role === "Reliever");

    // Sort by player value (quality)
    const battersByValue = [...allBatters].sort((a, b) =>
      this.calculateLineupValue(b) - this.calculateLineupValue(a)
    );

    const startersByValue = [...allStarters].sort((a, b) =>
      this.calculateLineupValue(b) - this.calculateLineupValue(a)
    );

    const relieversByValue = [...allRelievers].sort((a, b) =>
      this.calculateLineupValue(b) - this.calculateLineupValue(a)
    );

    // Build lineup - cycle through available players to fill standard positions
    // For small rosters, players appear multiple times
    const batterLineup: string[] = [];
    for (let i = 0; i < GAME_CONSTANTS.LINEUP_COMPOSITION.BATTERS; i++) {
      const batter = battersByValue[i % battersByValue.length];
      if (batter) batterLineup.push(batter.id);
    }

    const starterLineup: string[] = [];
    for (let i = 0; i < GAME_CONSTANTS.LINEUP_COMPOSITION.STARTERS; i++) {
      const starter = startersByValue[i % Math.max(1, startersByValue.length)];
      if (starter) starterLineup.push(starter.id);
    }

    const relieverLineup: string[] = [];
    for (let i = 0; i < GAME_CONSTANTS.LINEUP_COMPOSITION.RELIEVERS; i++) {
      const reliever = relieversByValue[i % Math.max(1, relieversByValue.length)];
      if (reliever) relieverLineup.push(reliever.id);
    }

    const newLineup = [...batterLineup, ...starterLineup, ...relieverLineup];

    // Check if anything changed
    const lineupChanged =
      newLineup.length !== team.lineup.length ||
      newLineup.some((id, i) => team.lineup[i] !== id);

    if (!lineupChanged) {
      return null; // No changes needed
    }

    return { lineup: newLineup };
  }

  /**
   * Get the current RNG seed (for save/replay)
   */
  getSeed(): number {
    return this.rng.getSeed();
  }

  /**
   * Set the RNG seed (for loading saved state)
   */
  setSeed(seed: number): void {
    this.rng.setSeed(seed);
  }
}

/**
 * Global game controller instance
 */
export const gameController = new GameController();
