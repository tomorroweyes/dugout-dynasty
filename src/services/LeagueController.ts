import {
  League,
  LeagueTier,
  SeasonResult,
  StandingsEntry,
} from "@/types/league";
import { Team } from "@/types/game";
import { GAME_CONSTANTS } from "@/engine/constants";
import { generateLeague, calculateStandings } from "@/engine/leagueGenerator";
import { simulateAIMatch, calculateMatchImportance } from "@/engine/aiMatchSimulator";

/**
 * LeagueController - manages season progression and league state
 */
class LeagueController {
  /**
   * Start a new season in the specified tier
   */
  startNewSeason(tier: LeagueTier, humanTeam: Team, season: number): League {
    return generateLeague(tier, humanTeam, season);
  }

  /**
   * Simulate all AI vs AI matches for the current week
   * Called after player completes their match
   */
  simulateWeek(league: League): League {
    const currentWeek = league.schedule.weeks[league.currentWeek];
    if (!currentWeek) return league;

    // Create a map of updated teams
    const updatedTeams = new Map(league.teams.map((t) => [t.id, t]));

    // Calculate match importance for this week
    const matchImportance = calculateMatchImportance(
      league.currentWeek,
      league.totalWeeks
    );

    // Simulate each match in the week
    for (const match of currentWeek.matches) {
      // Skip if already completed (player's match)
      if (match.completed) continue;

      const homeTeam = updatedTeams.get(match.homeTeamId);
      const awayTeam = updatedTeams.get(match.awayTeamId);

      if (!homeTeam || !awayTeam) continue;

      // Skip if human team is involved (they play manually)
      if (
        match.homeTeamId === league.humanTeamId ||
        match.awayTeamId === league.humanTeamId
      ) {
        continue;
      }

      // Simulate AI vs AI match
      const { result, homeTeam: updatedHome, awayTeam: updatedAway } =
        simulateAIMatch(homeTeam, awayTeam, matchImportance);

      // Update teams in map
      updatedTeams.set(homeTeam.id, updatedHome);
      updatedTeams.set(awayTeam.id, updatedAway);

      // Mark match complete
      match.completed = true;
      match.result = result;
    }

    // Recalculate standings
    const allTeams = Array.from(updatedTeams.values());
    const standings = calculateStandings(allTeams);

    return {
      ...league,
      teams: allTeams,
      standings,
    };
  }

  /**
   * Complete the current week and advance to next
   * Returns updated league with incremented week counter
   */
  completeWeek(league: League): League {
    // First simulate all AI matches
    const simulatedLeague = this.simulateWeek(league);

    // Check if season is complete
    if (simulatedLeague.currentWeek >= simulatedLeague.totalWeeks - 1) {
      return this.completeSeason(simulatedLeague);
    }

    // Advance to next week
    return {
      ...simulatedLeague,
      currentWeek: simulatedLeague.currentWeek + 1,
    };
  }

  /**
   * Complete the season and calculate results
   */
  completeSeason(league: League): League {
    const standings = calculateStandings(league.teams);
    const humanPosition =
      standings.findIndex((s) => s.teamId === league.humanTeamId) + 1;

    const humanStanding = standings.find((s) => s.teamId === league.humanTeamId);
    if (!humanStanding) {
      throw new Error("Human team not found in standings");
    }

    const seasonResult = this.calculateSeasonResult(
      humanPosition,
      league.tier,
      humanStanding
    );

    return {
      ...league,
      isComplete: true,
      standings,
      seasonResult,
    };
  }

  /**
   * Calculate rewards and progression from season results
   */
  calculateSeasonResult(
    position: number,
    tier: LeagueTier,
    standing: StandingsEntry
  ): SeasonResult {
    const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[tier];

    // Determine promotion/relegation
    const promoted = position <= tierConfig.promotionSlots;
    const relegated =
      position > tierConfig.numTeams - tierConfig.relegationSlots;

    // Calculate cash prize
    let cashPrize = 0;
    if (position === 1) {
      cashPrize = tierConfig.rewards.championshipCash;
    } else if (position <= Math.floor(tierConfig.numTeams / 2)) {
      cashPrize = tierConfig.rewards.topHalfCash;
    }

    // Calculate scout points
    const scoutPoints = standing.wins * tierConfig.rewards.scoutPointsPerWin;

    // Calculate fan bonus
    const fanBonus = standing.wins * tierConfig.rewards.fanMultiplierGrowth;

    // Determine next tier
    let nextTier: LeagueTier | undefined;
    if (promoted) {
      nextTier = this.getNextTier(tier);
    } else if (relegated) {
      nextTier = this.getPreviousTier(tier);
    }

    return {
      finalPosition: position,
      totalWins: standing.wins,
      totalLosses: standing.losses,
      cashPrize,
      scoutPoints,
      fanBonus,
      promoted,
      relegated,
      nextTier,
    };
  }

  /**
   * Get the next tier for promotion
   */
  getNextTier(current: LeagueTier): LeagueTier | undefined {
    const tiers: LeagueTier[] = [
      "SANDLOT",
      "LOCAL",
      "REGIONAL",
      "NATIONAL",
      "WORLD",
    ];
    const index = tiers.indexOf(current);
    return index < tiers.length - 1 ? tiers[index + 1] : undefined;
  }

  /**
   * Get the previous tier for relegation
   */
  getPreviousTier(current: LeagueTier): LeagueTier | undefined {
    const tiers: LeagueTier[] = [
      "SANDLOT",
      "LOCAL",
      "REGIONAL",
      "NATIONAL",
      "WORLD",
    ];
    const index = tiers.indexOf(current);
    return index > 0 ? tiers[index - 1] : undefined;
  }

  /**
   * Get tier priority (for comparing tiers)
   */
  getTierPriority(tier: LeagueTier): number {
    const tiers: LeagueTier[] = [
      "SANDLOT",
      "LOCAL",
      "REGIONAL",
      "NATIONAL",
      "WORLD",
    ];
    return tiers.indexOf(tier);
  }
}

// Export singleton instance
export const leagueController = new LeagueController();
