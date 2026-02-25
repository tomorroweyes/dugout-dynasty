import { OpponentTeam, AIPersonality } from "@/types/league";
import { Player, isBatter, isPitcher } from "@/types/game";
import { GAME_CONSTANTS } from "./constants";

/**
 * Context for AI rotation decisions
 */
interface RotationContext {
  team: OpponentTeam;
  matchImportance: number; // 0-1: How critical is this match
  opponentStrength: number; // 0-1: How strong is the opponent
}

/**
 * Player with calculated effective value
 */
interface PlayerValue {
  player: Player;
  effectiveValue: number;
}

/**
 * Calculate base player rating (average of all stats)
 */
function getBaseRating(player: Player): number {
  if (isBatter(player)) {
    const stats = player.stats;
    return (stats.power + stats.contact + stats.glove + stats.speed) / 4;
  } else if (isPitcher(player)) {
    const stats = player.stats;
    return (stats.velocity + stats.control + stats.break) / 3;
  }
  return 50; // Default fallback
}

/**
 * Calculate effective value with personality-driven adjustments
 */
function calculateEffectiveValue(
  player: Player,
  personality: AIPersonality
): number {
  const baseValue = getBaseRating(player);

  // Personality adjustment: aggressive teams slightly boost star players
  const aggressionBonus = personality.aggression * (baseValue / 100); // Up to +1.0 for elite players

  return baseValue * (1 + aggressionBonus);
}

/**
 * AI rotation decision engine
 * Selects best players by effective value (personality-adjusted ratings)
 */
export function aiAutoRotate(context: RotationContext): {
  lineup: string[];
  bench: string[];
} {
  const { team } = context;
  const personality = team.aiPersonality;

  // 1. Evaluate all pitchers with effective value calculation
  const pitchers = team.roster.filter(isPitcher);
  const pitcherValues: PlayerValue[] = pitchers.map((pitcher) => ({
    player: pitcher,
    effectiveValue: calculateEffectiveValue(pitcher, personality),
  }));

  // 2. Separate starters and relievers
  const starters = pitcherValues
    .filter((p) => p.player.role === "Starter")
    .sort((a, b) => b.effectiveValue - a.effectiveValue);

  const relievers = pitcherValues
    .filter((p) => p.player.role === "Reliever")
    .sort((a, b) => b.effectiveValue - a.effectiveValue);

  // 3. Select best starter
  const selectedStarter = starters[0];

  // 4. Select best 2 relievers
  const selectedRelievers = relievers.slice(0, 2);

  // 5. Select batters (top 9 by effective value)
  const batters = team.roster.filter(isBatter);
  const batterValues: PlayerValue[] = batters
    .map((batter) => ({
      player: batter,
      effectiveValue: calculateEffectiveValue(batter, personality),
    }))
    .sort((a, b) => b.effectiveValue - a.effectiveValue);

  const lineupBatters = batterValues.slice(0, 9);

  // 6. Construct lineup
  const lineup = [
    ...lineupBatters.map((b) => b.player.id),
    selectedStarter.player.id,
    ...selectedRelievers.map((r) => r.player.id),
  ];

  // 7. Everyone not in lineup is on the bench
  const lineupSet = new Set(lineup);
  const bench = team.roster
    .filter((p) => !lineupSet.has(p.id))
    .map((p) => p.id);

  return { lineup, bench };
}

/**
 * Calculate team strength for opponent evaluation
 * Returns average player rating (0-100)
 */
export function calculateTeamStrength(team: OpponentTeam): number {
  const lineupPlayers = team.lineup
    .map((id) => team.roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  if (lineupPlayers.length === 0) return 50; // Default average

  const totalRating = lineupPlayers.reduce(
    (sum, player) => sum + getBaseRating(player),
    0
  );

  return totalRating / lineupPlayers.length;
}
