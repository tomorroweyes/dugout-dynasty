import type { Player } from "@/types/game";
import type { Ability, AbilityRecommendation } from "@/types/ability";
import { getPlayerAbilities, canActivateAbility } from "./abilitySystem";
import { isPitcher } from "@/types/game";

/**
 * Ability Recommendation System
 *
 * Provides smart default ability selections based on:
 * - Game situation (score, inning, bases)
 * - Player stats
 * - Spirit availability
 * - Ability effects
 */

// ============================================
// GAME CONTEXT
// ============================================

export interface GameContext {
  inning: number;
  outs: number;
  bases: [boolean, boolean, boolean]; // [first, second, third]
  myScore: number;
  opponentScore: number;
  isCloseGame: boolean; // Within 3 runs
  isLateGame: boolean; // Inning 7+
  runnersInScoringPosition: boolean; // Runner on 2nd or 3rd
  basesLoaded: boolean;
}

/**
 * Create game context from current state
 */
export function createGameContext(
  inning: number,
  outs: number,
  bases: [boolean, boolean, boolean],
  myScore: number,
  opponentScore: number
): GameContext {
  const scoreDiff = Math.abs(myScore - opponentScore);
  const isCloseGame = scoreDiff <= 3;
  const isLateGame = inning >= 7;
  const runnersInScoringPosition = bases[1] || bases[2]; // 2nd or 3rd base
  const basesLoaded = bases[0] && bases[1] && bases[2];

  return {
    inning,
    outs,
    bases,
    myScore,
    opponentScore,
    isCloseGame,
    isLateGame,
    runnersInScoringPosition,
    basesLoaded,
  };
}

// ============================================
// RECOMMENDATION SCORING
// ============================================

/**
 * Score an ability based on game context and player situation
 * Returns 0-100, higher = better recommendation
 */
function scoreAbilityForContext(
  ability: Ability,
  player: Player,
  context: GameContext
): {
  score: number;
  reason: string;
} {
  let score = 50; // Base score
  let reasons: string[] = [];

  // Check if ability can be activated
  const { canActivate } = canActivateAbility(player, ability.id);
  if (!canActivate) {
    return { score: 0, reason: "Not enough spirit" };
  }

  // Analyze ability effects for context
  const abilityId = ability.id;

  // === BATTER ABILITIES ===

  // Power Swing / Moonshot / Tectonic Blast - best with runners on base
  if (
    abilityId === "power_swing" ||
    abilityId === "moonshot" ||
    abilityId === "tectonic_blast"
  ) {
    if (context.runnersInScoringPosition) {
      score += 30;
      reasons.push("Runners in scoring position");
    }
    if (context.basesLoaded) {
      score += 20;
      reasons.push("Bases loaded - grand slam opportunity!");
    }
    if (context.isLateGame && context.myScore < context.opponentScore) {
      score += 15;
      reasons.push("Need runs late in game");
    }
  }

  // Moonshot - high risk/reward, best in desperate situations
  if (abilityId === "moonshot") {
    if (context.isLateGame && context.myScore < context.opponentScore - 2) {
      score += 25;
      reasons.push("Desperate situation - go for it!");
    }
    if (context.outs === 2) {
      score += 10;
      reasons.push("Two outs - take the risk");
    }
  }

  // Patience / Pest - good for getting on base
  if (abilityId === "patience" || abilityId === "pest") {
    if (context.bases[0] === false) {
      score += 20;
      reasons.push("Empty bases - get on base");
    }
    if (context.isLateGame && context.isCloseGame) {
      score += 15;
      reasons.push("Need baserunners in close game");
    }
  }

  // Crazy Bunt - best with fast runners, empty bases
  if (abilityId === "crazy_bunt") {
    if (context.bases[0] === false && context.outs < 2) {
      score += 25;
      reasons.push("Good bunting situation");
    }
    if (context.inning <= 3) {
      score += 10;
      reasons.push("Early game - set the table");
    }
  }

  // Base Stealer - get on base abilities
  if (abilityId === "base_stealer") {
    if (context.bases[0] === false) {
      score += 20;
      reasons.push("Need baserunner");
    }
  }

  // Clutch Contact - best in high-pressure situations
  if (abilityId === "clutch_contact") {
    if (context.runnersInScoringPosition && context.outs === 2) {
      score += 35;
      reasons.push("Two outs, RISP - clutch time!");
    }
    if (context.isLateGame && context.isCloseGame) {
      score += 20;
      reasons.push("Clutch situation");
    }
  }

  // Defensive Wall - good early/mid game
  if (abilityId === "defensive_wall") {
    if (context.inning <= 5) {
      score += 15;
      reasons.push("Set up defense early");
    }
  }

  // === PITCHER ABILITIES ===

  // Fireball / Strikeout King - best with runners on base (prevent runs)
  if (abilityId === "fireball" || abilityId === "strikeout_king") {
    if (context.runnersInScoringPosition) {
      score += 30;
      reasons.push("Runners in scoring position - need strikeout");
    }
    if (context.outs === 2) {
      score += 15;
      reasons.push("Two outs - finish the inning");
    }
  }

  // Ice Shard / Meteor Sinker - good for ground balls
  if (abilityId === "ice_shard" || abilityId === "meteor_sinker") {
    if (context.bases[0] && !context.bases[1]) {
      score += 20;
      reasons.push("Runner on first - induce ground ball");
    }
  }

  // Time Warp - best late in game when fatigued
  if (abilityId === "time_warp") {
    if (context.inning >= 6) {
      score += 25;
      reasons.push("Negate fatigue");
    }
    if (context.isLateGame && context.isCloseGame) {
      score += 20;
      reasons.push("Close game - need fresh arm");
    }
  }

  // Perfect Pitch - ultimate ability, save for critical moments
  if (abilityId === "perfect_pitch") {
    if (context.basesLoaded) {
      score += 40;
      reasons.push("Bases loaded - use ultimate pitch");
    }
    if (context.isLateGame && context.isCloseGame) {
      score += 30;
      reasons.push("Critical moment");
    }
  }

  // Penalty for high spirit cost relative to available spirit
  const spiritPercentage = (ability.spiritCost / player.spirit.current) * 100;
  if (spiritPercentage > 70) {
    score -= 15;
    reasons.push("High spirit cost");
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  const reason = reasons.length > 0 ? reasons.join(", ") : "Solid choice";

  return { score, reason };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get ability recommendations for a player in current game context
 * Returns sorted list (best first)
 */
export function getAbilityRecommendations(
  player: Player,
  context: GameContext
): AbilityRecommendation[] {
  const availableAbilities = getPlayerAbilities(player);

  const recommendations: AbilityRecommendation[] = availableAbilities
    .map((ability) => {
      const { score, reason } = scoreAbilityForContext(ability, player, context);
      return {
        abilityId: ability.id,
        reason,
        priority: Math.floor(score / 10), // Convert 0-100 to 0-10
      };
    })
    .filter((rec) => rec.priority > 0); // Filter out unusable abilities

  // Sort by priority (highest first)
  recommendations.sort((a, b) => b.priority - a.priority);

  return recommendations;
}

/**
 * Get the single best recommended ability for current situation
 * Returns undefined if no good recommendations
 */
export function getBestRecommendation(
  player: Player,
  context: GameContext
): string | undefined {
  const recommendations = getAbilityRecommendations(player, context);
  return recommendations.length > 0 ? recommendations[0].abilityId : undefined;
}

/**
 * Check if an ability is recommended for the current situation
 */
export function isRecommendedAbility(
  player: Player,
  abilityId: string,
  context: GameContext
): boolean {
  const recommendations = getAbilityRecommendations(player, context);
  // Consider top 3 recommendations as "recommended"
  const topRecommendations = recommendations.slice(0, 3);
  return topRecommendations.some((rec) => rec.abilityId === abilityId);
}
