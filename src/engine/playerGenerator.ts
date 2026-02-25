import { faker } from "@faker-js/faker";
import { Player, PlayerTrait } from "@/types/game";
import { LeagueTier } from "@/types/league";
import type { PlayerArchetype, PlayerAbility } from "@/types/ability";
import { calculateMaxSpirit } from "@/types/ability";
import { GAME_CONSTANTS } from "./constants";
import {
  PLAYER_GENERATION_TEMPLATES,
  PlayerQualityTier,
  getBatterOverall,
  getPitcherOverall,
  clampBatterStat,
  clampPitcherStat,
} from "./statConfig";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";
import { LEVEL_CONSTANTS } from "./xpConfig";
import {
  getStarterTechniqueId,
  getTechniquesForArchetype,
} from "@/data/techniques";
import {
  ALL_TRAITS,
  ARCHETYPE_TRAIT_WEIGHTS,
  ROLE_TRAIT_WEIGHTS,
  SECONDARY_TRAIT_CHANCE,
} from "./synergyConfig";

// ============================================
// TRAIT ASSIGNMENT
// ============================================

/**
 * Pick a trait from a weighted distribution.
 */
function pickWeightedTrait(
  weights: Partial<Record<PlayerTrait, number>>,
  rng: RandomProvider,
  exclude?: PlayerTrait[]
): PlayerTrait {
  const candidates = ALL_TRAITS.filter((t) => !exclude?.includes(t));
  const weighted = candidates.map((t) => ({
    trait: t,
    weight: weights[t] ?? 0,
  }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  // If no weights match, uniform random among candidates
  if (totalWeight === 0) {
    return candidates[rng.randomInt(0, candidates.length)];
  }

  let roll = rng.random() * totalWeight;
  for (const { trait, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return trait;
  }
  return candidates[candidates.length - 1]; // Safety fallback
}

/**
 * Generate traits for a player.
 * - Primary trait: weighted by archetype (if available) or role
 * - Secondary trait (50% chance): uniform random from remaining 9
 */
function generateTraits(
  role: "Batter" | "Starter" | "Reliever",
  archetype: PlayerArchetype | undefined,
  rng: RandomProvider
): PlayerTrait[] {
  const isPitcherRole = role === "Starter" || role === "Reliever";

  // Determine primary trait weights
  const weights = archetype
    ? (ARCHETYPE_TRAIT_WEIGHTS[archetype] ?? {})
    : (ROLE_TRAIT_WEIGHTS[isPitcherRole ? "Pitcher" : "Batter"] ?? {});

  const primary = pickWeightedTrait(weights, rng);
  const traits: PlayerTrait[] = [primary];

  // 50% chance for secondary trait (uniform random from remaining)
  if (rng.random() < SECONDARY_TRAIT_CHANCE) {
    const secondary = ALL_TRAITS.filter((t) => t !== primary);
    traits.push(secondary[rng.randomInt(0, secondary.length)]);
  }

  return traits;
}

/**
 * Get roster size configuration for a specific league tier
 */
export function getRosterSizeByTier(tier: LeagueTier) {
  return GAME_CONSTANTS.ROSTER_SIZES_BY_TIER[tier];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate salary based on player overall rating
 * Better players cost more
 */
function calculateSalary(overall: number): number {
  // Salary scales exponentially with quality
  // POOR (0-30): $100-200
  // AVERAGE (30-50): $200-400
  // GOOD (50-70): $400-800
  // GREAT (70-85): $800-1500
  // ELITE (85-100): $1500-3000
  const baseSalary = 100;
  const multiplier = Math.pow(overall / 30, 2);
  return Math.floor(baseSalary + multiplier * 100);
}

/**
 * Generate a player with specified quality tier
 * @param role - Player position/role
 * @param tier - Quality tier (ROOKIE, AVERAGE, GOOD, STAR, ELITE)
 * @param rng - Optional random provider for deterministic generation
 */
export function generatePlayer(
  role: "Batter" | "Starter" | "Reliever",
  tier: PlayerQualityTier = "ROOKIE",
  rng: RandomProvider = getDefaultRandomProvider()
): Player {
  // Generate realistic player name using Faker.js
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;

  const isPitcher = role === "Starter" || role === "Reliever";

  // Generate role-specific stats using tier-appropriate ranges
  let stats;
  let overall: number;

  if (isPitcher) {
    const template = PLAYER_GENERATION_TEMPLATES.PITCHER[tier];
    stats = {
      velocity: clampPitcherStat(
        "velocity",
        rng.randomIntInclusive(template.VELOCITY.min, template.VELOCITY.max)
      ),
      control: clampPitcherStat(
        "control",
        rng.randomIntInclusive(template.CONTROL.min, template.CONTROL.max)
      ),
      break: clampPitcherStat(
        "break",
        rng.randomIntInclusive(template.BREAK.min, template.BREAK.max)
      ),
    };
    overall = getPitcherOverall(stats);
  } else {
    const template = PLAYER_GENERATION_TEMPLATES.BATTER[tier];
    stats = {
      power: clampBatterStat(
        "power",
        rng.randomIntInclusive(template.POWER.min, template.POWER.max)
      ),
      contact: clampBatterStat(
        "contact",
        rng.randomIntInclusive(template.CONTACT.min, template.CONTACT.max)
      ),
      glove: clampBatterStat(
        "glove",
        rng.randomIntInclusive(template.GLOVE.min, template.GLOVE.max)
      ),
      speed: clampBatterStat(
        "speed",
        rng.randomIntInclusive(template.SPEED.min, template.SPEED.max)
      ),
    };
    overall = getBatterOverall(stats);
  }

  const salary = calculateSalary(overall);

  // Generate traits (pre-archetype, uses role-based fallback weights)
  const traits = generateTraits(role, undefined, rng);

  return {
    id: generateId(),
    name,
    surname: lastName,
    role,
    stats,
    salary,
    // XP & Leveling fields
    level: LEVEL_CONSTANTS.STARTING_LEVEL,
    xp: LEVEL_CONSTANTS.STARTING_XP,
    totalXpEarned: LEVEL_CONSTANTS.STARTING_XP,
    // Equipment (Phase 2) - Start with no equipped items
    equipment: {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
    // Abilities & Techniques (Phase 4) - Start without archetype
    class: undefined, // Chosen at level 1 (players can select class immediately)
    spirit: {
      current: 50, // Default spirit for level 1
      max: 50,
    },
    abilities: [], // Techniques learned after archetype selection
    skillPoints: 1, // Start with 1 skill point for immediate customization
    maxTechniqueSlots: 5, // Base technique slots (will increase with level)
    // Traits (Synergy System) - permanent, assigned at generation
    traits,
  };
}

/**
 * Generate a starter team for a specific league tier
 * Roster size scales with tier: SANDLOT starts with 4 players, WORLD has 17
 * @param rng - Optional random provider for deterministic generation
 * @param tier - League tier (determines roster size)
 */
export function generateStarterTeam(
  rng: RandomProvider = getDefaultRandomProvider(),
  tier: LeagueTier = "SANDLOT"
): Player[] {
  const roster: Player[] = [];
  const rosterSize = getRosterSizeByTier(tier);

  // Quality distribution: mix of GOOD/SOLID/AVERAGE
  // Early tiers get stronger players to compensate for small roster
  const getBatterTier = (index: number, total: number): PlayerQualityTier => {
    if (total <= 4) return index === 0 ? "GOOD" : "SOLID"; // SANDLOT: 1 good, rest solid
    if (total <= 6) return index < 2 ? "GOOD" : "SOLID"; // LOCAL: 2 good, rest solid
    // Larger rosters get more varied quality
    const ratio = index / total;
    if (ratio < 0.25) return "GOOD";
    if (ratio < 0.7) return "SOLID";
    return "AVERAGE";
  };

  // Generate batters
  for (let i = 0; i < rosterSize.batters; i++) {
    const tier = getBatterTier(i, rosterSize.batters);
    roster.push(generatePlayer("Batter", tier, rng));
  }

  // Generate starters (always SOLID quality)
  for (let i = 0; i < rosterSize.starters; i++) {
    const tier = i === 0 ? "GOOD" : "SOLID"; // First starter is better
    roster.push(generatePlayer("Starter", tier, rng));
  }

  // Generate relievers (always SOLID quality)
  for (let i = 0; i < rosterSize.relievers; i++) {
    roster.push(generatePlayer("Reliever", "SOLID", rng));
  }

  return roster;
}

/**
 * Generate a team with specific quality tier and league tier
 * Useful for testing or creating opponents of specific difficulty
 * @param qualityTier - Quality tier for all players (ROOKIE, AVERAGE, GOOD, STAR, ELITE)
 * @param rng - Optional random provider for deterministic generation
 * @param leagueTier - League tier (determines roster size)
 */
export function generateTeamByTier(
  qualityTier: PlayerQualityTier,
  rng: RandomProvider = getDefaultRandomProvider(),
  leagueTier: LeagueTier = "SANDLOT"
): Player[] {
  const roster: Player[] = [];
  const rosterSize = getRosterSizeByTier(leagueTier);

  for (let i = 0; i < rosterSize.batters; i++) {
    roster.push(generatePlayer("Batter", qualityTier, rng));
  }

  for (let i = 0; i < rosterSize.starters; i++) {
    roster.push(generatePlayer("Starter", qualityTier, rng));
  }

  for (let i = 0; i < rosterSize.relievers; i++) {
    roster.push(generatePlayer("Reliever", qualityTier, rng));
  }

  return roster;
}

// ============================================
// OPPONENT ABILITY ASSIGNMENT
// ============================================

const BATTER_ARCHETYPES: PlayerArchetype[] = [
  "Slugger",
  "Contact Hitter",
  "Speed Demon",
];
const PITCHER_ARCHETYPES: PlayerArchetype[] = [
  "Flamethrower",
  "Painter",
  "Trickster",
];

/**
 * Assign a random archetype and techniques to a generated player.
 * Used for opponent teams so they have abilities during matches.
 *
 * @param player - Base player to assign abilities to
 * @param techniqueCount - Additional techniques beyond the starter (0 = starter only)
 * @param rng - Random provider for deterministic generation
 */
export function assignArchetypeAndAbilities(
  player: Player,
  techniqueCount: number = 0,
  rng: RandomProvider = getDefaultRandomProvider()
): Player {
  const isPitcherRole = player.role === "Starter" || player.role === "Reliever";
  const archetypes = isPitcherRole ? PITCHER_ARCHETYPES : BATTER_ARCHETYPES;
  const archetype = archetypes[rng.randomInt(0, archetypes.length)];

  const starterTechniqueId = getStarterTechniqueId(archetype);
  const abilities: PlayerAbility[] = [
    { abilityId: starterTechniqueId, rank: 1, timesUsed: 0 },
  ];

  // Grant additional techniques (pick from available, skip ones requiring prerequisites)
  if (techniqueCount > 0) {
    const available = getTechniquesForArchetype(archetype).filter(
      (t) => t.id !== starterTechniqueId && !t.prerequisiteAbilityId
    );
    const count = Math.min(techniqueCount, available.length);
    for (let i = 0; i < count; i++) {
      abilities.push({
        abilityId: available[i].id,
        rank: 1,
        timesUsed: 0,
      });
    }
  }

  // If player has no traits yet (legacy), generate with archetype weights
  const traits = player.traits?.length
    ? player.traits
    : generateTraits(player.role, archetype, rng);

  const maxSpirit = calculateMaxSpirit(player.level);
  return {
    ...player,
    class: archetype,
    abilities,
    spirit: { current: maxSpirit, max: maxSpirit },
    skillPoints: 0,
    maxTechniqueSlots: 5 + Math.floor(player.level / 10),
    traits,
  };
}

/**
 * Get number of additional techniques opponents should have based on league tier.
 */
export function getTechniqueCountForTier(tier: LeagueTier): number {
  switch (tier) {
    case "SANDLOT":
      return 0; // Starter technique only
    case "LOCAL":
      return 1;
    case "REGIONAL":
      return 2;
    case "NATIONAL":
      return 3;
    case "WORLD":
      return 4;
  }
}
