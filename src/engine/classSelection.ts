import type { Player, PlayerAbility, PitcherStats, BatterStats } from "@/types/game";
import type { PlayerClass } from "@/types/ability";
import { CLASS_INFO, calculateMaxSpirit } from "@/types/ability";
import { isPitcher } from "@/types/game";
import { getStarterTechniqueId } from "@/data/techniques";

/**
 * Archetype Selection Logic (formerly Class Selection)
 *
 * Handles:
 * - Available archetype options for players
 * - Archetype selection at level 1 (immediate customization)
 * - Spirit initialization
 * - Initial skill point calculation
 * - Starter technique granting
 */

// ============================================
// CLASS ELIGIBILITY
// ============================================

/**
 * Get available archetype options for a player
 */
export function getAvailableClasses(player: Player): PlayerClass[] {
  if (isPitcher(player)) {
    // Pitchers can be Flamethrower (power), Painter (control), or Trickster (deception)
    return ["Flamethrower", "Painter", "Trickster"];
  } else {
    // Batters can be Slugger, Contact Hitter, or Speed Demon
    return ["Slugger", "Contact Hitter", "Speed Demon"];
  }
}

/**
 * Check if a player is eligible to select a class
 */
export function canSelectClass(player: Player): boolean {
  // Can select if level 1+ and no class chosen yet (immediate customization)
  return player.level >= 1 && !player.class;
}

/**
 * Check if a class is valid for a player
 */
export function isValidClassForPlayer(
  player: Player,
  className: PlayerClass
): boolean {
  const availableClasses = getAvailableClasses(player);
  return availableClasses.includes(className);
}

// ============================================
// CLASS ASSIGNMENT
// ============================================

/**
 * Assign an archetype to a player (available immediately at level 1)
 * Grants starter technique and initializes technique slots
 */
export function selectClass(player: Player, className: PlayerClass): Player {
  if (!canSelectClass(player)) {
    console.warn("Player cannot select archetype yet (requires level 1)");
    return player;
  }

  if (!isValidClassForPlayer(player, className)) {
    console.warn(`Invalid archetype ${className} for player role ${player.role}`);
    return player;
  }

  // Calculate initial spirit and skill points
  const maxSpirit = calculateMaxSpirit(player.level);
  const skillPoints = player.skillPoints; // Keep existing skill points (starts at 1)

  // Grant starter technique for this archetype
  const starterTechniqueId = getStarterTechniqueId(className);
  const starterTechnique: PlayerAbility = {
    abilityId: starterTechniqueId,
    rank: 1,
    timesUsed: 0,
  };

  // Calculate max technique slots: 5 base + 1 per 10 levels
  const maxTechniqueSlots = 5 + Math.floor(player.level / 10);

  return {
    ...player,
    class: className,
    spirit: {
      current: maxSpirit,
      max: maxSpirit,
    },
    skillPoints,
    abilities: [starterTechnique], // Start with archetype's starter technique
    maxTechniqueSlots,
  };
}

// ============================================
// CLASS RECOMMENDATIONS
// ============================================

export interface ClassRecommendation {
  className: PlayerClass;
  score: number; // 0-100, higher = better fit
  reason: string;
}

/**
 * Get recommended archetype based on player stats (for UI hints)
 */
export function getClassRecommendations(
  player: Player
): ClassRecommendation[] {
  const availableClasses = getAvailableClasses(player);

  // Pitchers get Flamethrower, Painter, or Trickster recommendations
  if (isPitcher(player)) {
    const stats = player.stats as PitcherStats;
    const recommendations: ClassRecommendation[] = [];

    // Flamethrower recommendation (velocity focused)
    const flamethrowerScore = stats.velocity * 0.7 + stats.break * 0.2 + stats.control * 0.1;
    recommendations.push({
      className: "Flamethrower",
      score: flamethrowerScore,
      reason:
        stats.velocity >= 60
          ? "Your blazing fastball makes you a dominant power pitcher"
          : "Flamethrower focuses on raw power and intimidation",
    });

    // Painter recommendation (control focused)
    const painterScore = stats.control * 0.7 + stats.velocity * 0.2 + stats.break * 0.1;
    recommendations.push({
      className: "Painter",
      score: painterScore,
      reason:
        stats.control >= 60
          ? "Your pinpoint control makes you a master of location"
          : "Painter paints corners and induces weak contact",
    });

    // Trickster recommendation (break focused)
    const tricksterScore = stats.break * 0.7 + stats.control * 0.2 + stats.velocity * 0.1;
    recommendations.push({
      className: "Trickster",
      score: tricksterScore,
      reason:
        stats.break >= 60
          ? "Your devastating breaking balls keep batters off-balance"
          : "Trickster uses deception and breaking pitches to dominate",
    });

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations;
  }

  // For batters, analyze stats to provide recommendations
  const stats = player.stats as BatterStats;
  const recommendations: ClassRecommendation[] = [];

  // Contact Hitter recommendation (contact + defense focused)
  const contactScore = stats.contact * 0.5 + stats.glove * 0.5;
  recommendations.push({
    className: "Contact Hitter",
    score: contactScore,
    reason:
      stats.contact >= stats.power && stats.glove >= 60
        ? "Your strong contact and defense make you a natural Contact Hitter"
        : stats.contact >= stats.power
        ? "Your contact skills align well with Contact Hitter techniques"
        : "Contact Hitter offers consistent hitting and high average",
  });

  // Slugger recommendation (power focused)
  const sluggerScore = stats.power * 0.7 + stats.contact * 0.3;
  recommendations.push({
    className: "Slugger",
    score: sluggerScore,
    reason:
      stats.power > stats.contact && stats.power >= 60
        ? "Your raw power makes you a devastating slugger"
        : stats.power >= 60
        ? "Slugger techniques will amplify your power hitting"
        : "Slugger focuses on home runs and extra-base hits",
  });

  // Speed Demon recommendation (balanced/utility/speed)
  const balanceScore = 100 - Math.abs(stats.power - stats.contact);
  const speedScore = balanceScore * 0.6 + stats.contact * 0.3 + stats.glove * 0.1;
  recommendations.push({
    className: "Speed Demon",
    score: speedScore,
    reason:
      Math.abs(stats.power - stats.contact) < 15
        ? "Your balanced stats are perfect for Speed Demon versatility"
        : "Speed Demon offers base stealing and tactical play",
  });

  // Sort by score (highest first)
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}

/**
 * Get the single best recommended class for a player
 */
export function getRecommendedClass(player: Player): PlayerClass {
  const recommendations = getClassRecommendations(player);
  return recommendations[0].className;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get class info for display
 */
export function getClassInfo(className: PlayerClass) {
  return CLASS_INFO[className];
}

/**
 * Format class name for display
 */
export function formatClassName(className: PlayerClass): string {
  return CLASS_INFO[className].displayName;
}

/**
 * Check if player has selected a class
 */
export function hasSelectedClass(player: Player): boolean {
  return player.class !== undefined && player.class !== null;
}
