import { OpponentTeam } from "@/types/league";
import { MatchResult } from "@/types/game";
import { simulateMatch } from "./matchEngine";
import { aiAutoRotate, calculateTeamStrength } from "./aiRotation";
import { accumulateMatchStats } from "./statAccumulation";

/**
 * Simulate a match between two AI teams
 * Uses existing matchEngine but applies AI rotations first
 */
export function simulateAIMatch(
  homeTeam: OpponentTeam,
  awayTeam: OpponentTeam,
  matchImportance: number = 0.5
): { result: MatchResult; homeTeam: OpponentTeam; awayTeam: OpponentTeam } {
  // 1. Both teams auto-rotate their rosters
  const homeRotation = aiAutoRotate({
    team: homeTeam,
    matchImportance,
    opponentStrength: calculateTeamStrength(awayTeam),
  });

  const awayRotation = aiAutoRotate({
    team: awayTeam,
    matchImportance,
    opponentStrength: calculateTeamStrength(homeTeam),
  });

  // 2. Apply rotations to team state
  const rotatedHomeTeam: OpponentTeam = {
    ...homeTeam,
    lineup: homeRotation.lineup,
  };

  const rotatedAwayTeam: OpponentTeam = {
    ...awayTeam,
    lineup: awayRotation.lineup,
  };

  // 3. Simulate match using existing engine
  // Cast OpponentTeam to Team for match engine compatibility
  const result = simulateMatch(rotatedHomeTeam, rotatedAwayTeam);

  // 4. Accumulate player stats and update team records
  const { homeRoster, awayRoster } = result.boxScore
    ? accumulateMatchStats(rotatedHomeTeam.roster, rotatedAwayTeam.roster, result.boxScore)
    : { homeRoster: rotatedHomeTeam.roster, awayRoster: rotatedAwayTeam.roster };
  const updatedHomeTeam: OpponentTeam = {
    ...rotatedHomeTeam,
    roster: homeRoster,
    wins: rotatedHomeTeam.wins + (result.isWin ? 1 : 0),
    losses: rotatedHomeTeam.losses + (result.isWin ? 0 : 1),
  };

  const updatedAwayTeam: OpponentTeam = {
    ...rotatedAwayTeam,
    roster: awayRoster,
    wins: rotatedAwayTeam.wins + (result.isWin ? 0 : 1),
    losses: rotatedAwayTeam.losses + (result.isWin ? 1 : 0),
  };

  return {
    result,
    homeTeam: updatedHomeTeam,
    awayTeam: updatedAwayTeam,
  };
}

/**
 * Calculate match importance based on league state
 * Later weeks are more important (playoff race)
 */
export function calculateMatchImportance(
  currentWeek: number,
  totalWeeks: number
): number {
  const progress = currentWeek / totalWeeks;
  return 0.3 + progress * 0.7; // 0.3 early season → 1.0 final week
}
