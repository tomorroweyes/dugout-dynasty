import { faker } from "@faker-js/faker";
import {
  League,
  LeagueTier,
  OpponentTeam,
  AIPersonality,
  MatchSchedule,
  Week,
  ScheduledMatch,
  StandingsEntry,
} from "@/types/league";
import { Team, isBatter, isPitcher } from "@/types/game";
import { GAME_CONSTANTS } from "./constants";
import {
  generateTeamByTier,
  assignArchetypeAndAbilities,
  getTechniqueCountForTier,
} from "./playerGenerator";
import { PlayerQualityTier } from "./statConfig";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";

/**
 * Generate a unique ID for entities
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Map league tier to player quality tier for opponent generation
 * Sandlot starts at SOLID tier to match human starter team quality
 */
function getTierQuality(tier: LeagueTier): PlayerQualityTier {
  switch (tier) {
    case "SANDLOT":
      return "SOLID"; // Match human starter team (3 GOOD + 5 SOLID + 4 AVG ≈ SOLID overall)
    case "LOCAL":
      return "SOLID"; // Same base, but 1.0-1.1x multiplier makes them tougher
    case "REGIONAL":
      return "GOOD"; // Step up to GOOD tier
    case "NATIONAL":
      return "STAR"; // STAR tier for national competition
    case "WORLD":
      return "ELITE"; // Elite competition
  }
}

/**
 * Generate team colors (for visual identity)
 */
function generateTeamColors(): { primary: string; secondary: string } {
  const colorPairs = [
    { primary: "#1E40AF", secondary: "#DBEAFE" }, // Blue
    { primary: "#DC2626", secondary: "#FEE2E2" }, // Red
    { primary: "#16A34A", secondary: "#DCFCE7" }, // Green
    { primary: "#D97706", secondary: "#FEF3C7" }, // Orange
    { primary: "#7C3AED", secondary: "#EDE9FE" }, // Purple
    { primary: "#0891B2", secondary: "#CFFAFE" }, // Cyan
    { primary: "#CA8A04", secondary: "#FEF9C3" }, // Yellow
    { primary: "#BE123C", secondary: "#FFE4E6" }, // Rose
  ];

  const rng = getDefaultRandomProvider();
  const randomIndex = rng.randomInt(0, colorPairs.length);
  return colorPairs[randomIndex];
}

/**
 * Get a random AI personality preset
 */
function getRandomPersonality(): AIPersonality {
  const personalities = Object.values(GAME_CONSTANTS.AI_PERSONALITIES);
  const rng = getDefaultRandomProvider();
  const randomIndex = rng.randomInt(0, personalities.length);
  return personalities[randomIndex];
}

/**
 * Generate city and mascot names
 */
function generateTeamNames(): { city: string; mascot: string } {
  const cities = [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "Austin",
    "Boston",
    "Seattle",
    "Denver",
    "Atlanta",
    "Miami",
    "Portland",
    "Detroit",
    "Memphis",
    "Nashville",
    "Baltimore",
  ];

  const mascots = [
    "Eagles",
    "Tigers",
    "Dragons",
    "Hawks",
    "Warriors",
    "Knights",
    "Thunder",
    "Storm",
    "Wildcats",
    "Bulldogs",
    "Panthers",
    "Lions",
    "Bears",
    "Wolves",
    "Sharks",
    "Falcons",
    "Ravens",
    "Vipers",
    "Phoenix",
    "Titans",
  ];

  const rng = getDefaultRandomProvider();
  return {
    city: cities[rng.randomInt(0, cities.length)],
    mascot: mascots[rng.randomInt(0, mascots.length)],
  };
}

/**
 * Convert human Team to OpponentTeam format
 */
export function convertToOpponentTeam(
  team: Team,
  tier: LeagueTier
): OpponentTeam {
  const { city, mascot } = generateTeamNames();
  const colors = generateTeamColors();

  return {
    ...team,
    id: team.id || generateId(),
    name: `${city} ${mascot}`,
    city,
    mascot,
    tier,
    aiPersonality: GAME_CONSTANTS.AI_PERSONALITIES.BALANCED, // Human team uses balanced AI when simulating
    colors,
  };
}

/**
 * Generate a single opponent team for a specific tier
 */
export function generateOpponentTeam(
  tier: LeagueTier,
  rng: RandomProvider = getDefaultRandomProvider()
): OpponentTeam {
  const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[tier];
  const { city, mascot } = generateTeamNames();
  const colors = generateTeamColors();

  // Generate roster based on tier quality with variance
  const qualityTier = getTierQuality(tier);
  const strengthVariance =
    tierConfig.opponentStrength.min +
    rng.random() *
      (tierConfig.opponentStrength.max - tierConfig.opponentStrength.min);

  // Generate base roster with league-appropriate size
  const baseRoster = generateTeamByTier(qualityTier, rng, tier);

  // Scale roster by strength variance and assign archetypes/abilities
  const techniqueCount = getTechniqueCountForTier(tier);
  const roster = baseRoster.map((player) => {
    let scaled = player;
    if (isBatter(player)) {
      const stats = player.stats;
      scaled = {
        ...player,
        stats: {
          power: Math.floor(stats.power * strengthVariance),
          contact: Math.floor(stats.contact * strengthVariance),
          glove: Math.floor(stats.glove * strengthVariance),
        },
      };
    } else if (isPitcher(player)) {
      const stats = player.stats;
      scaled = {
        ...player,
        stats: {
          velocity: Math.floor(stats.velocity * strengthVariance),
          control: Math.floor(stats.control * strengthVariance),
          break: Math.floor(stats.break * strengthVariance),
        },
      };
    }
    // Assign archetype and abilities to opponent players
    return assignArchetypeAndAbilities(scaled, techniqueCount, rng);
  });

  // Build lineup - cycle through available players to fill standard positions
  // For small rosters, players may appear multiple times in batting order
  const batters = roster.filter(isBatter);
  const starters = roster.filter((p) => p.role === "Starter");
  const relievers = roster.filter((p) => p.role === "Reliever");

  const batterLineup: string[] = [];
  for (let i = 0; i < 9; i++) {
    const batter = batters[i % batters.length];
    if (batter) batterLineup.push(batter.id);
  }

  const starterLineup: string[] = [];
  for (let i = 0; i < 1; i++) {
    const starter = starters[i % Math.max(1, starters.length)];
    if (starter) starterLineup.push(starter.id);
  }

  const relieverLineup: string[] = [];
  for (let i = 0; i < 2; i++) {
    const reliever = relievers[i % Math.max(1, relievers.length)];
    if (reliever) relieverLineup.push(reliever.id);
  }

  const lineup = [...batterLineup, ...starterLineup, ...relieverLineup];

  return {
    id: generateId(),
    name: `${city} ${mascot}`,
    city,
    mascot,
    tier,
    cash: 0, // AI teams don't manage cash
    fans: 1.0,
    roster,
    lineup,
    wins: 0,
    losses: 0,
    aiPersonality: getRandomPersonality(),
    colors,
  };
}

/**
 * Generate round-robin schedule for a season
 * Each team plays every other team N times
 */
export function generateSeasonSchedule(
  teams: OpponentTeam[],
  gamesPerOpponent: number
): MatchSchedule {
  const weeks: Week[] = [];
  const teamIds = teams.map((t) => t.id);
  const numTeams = teamIds.length;

  // For odd number of teams, add a "bye" placeholder
  const workingIds = [...teamIds];
  if (numTeams % 2 !== 0) {
    workingIds.push("BYE");
  }

  let weekNumber = 1;

  // Generate multiple rounds (home and away)
  for (let round = 0; round < gamesPerOpponent; round++) {
    // Round-robin rotation (circle method)
    for (let week = 0; week < workingIds.length - 1; week++) {
      const matches: ScheduledMatch[] = [];

      for (let i = 0; i < workingIds.length / 2; i++) {
        const home = workingIds[i];
        const away = workingIds[workingIds.length - 1 - i];

        // Skip if BYE week
        if (home !== "BYE" && away !== "BYE") {
          // Alternate home/away in different rounds
          const isReverse = round % 2 === 1;
          matches.push({
            homeTeamId: isReverse ? away : home,
            awayTeamId: isReverse ? home : away,
            completed: false,
          });
        }
      }

      if (matches.length > 0) {
        weeks.push({ weekNumber, matches });
        weekNumber++;
      }

      // Rotate teams (keep first fixed, rotate others)
      const last = workingIds.pop()!;
      workingIds.splice(1, 0, last);
    }
  }

  return { weeks };
}

/**
 * Initialize standings for a new league
 */
export function initializeStandings(teams: OpponentTeam[]): StandingsEntry[] {
  return teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    wins: 0,
    losses: 0,
    runsScored: 0,
    runsAllowed: 0,
    streak: 0,
  }));
}

/**
 * Calculate current standings from team records
 */
export function calculateStandings(teams: OpponentTeam[]): StandingsEntry[] {
  const standings = teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    wins: team.wins,
    losses: team.losses,
    runsScored: 0, // TODO: Track cumulative runs in team stats
    runsAllowed: 0,
    streak: 0, // TODO: Calculate from match history
  }));

  // Sort by wins (descending), then by win percentage
  standings.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;

    const aWinPct = a.wins / (a.wins + a.losses || 1);
    const bWinPct = b.wins / (b.wins + b.losses || 1);
    return bWinPct - aWinPct;
  });

  return standings;
}

/**
 * Generate a complete league with teams and schedule
 */
export function generateLeague(
  tier: LeagueTier,
  humanTeam: Team,
  season: number
): League {
  const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[tier];

  // Convert human team to opponent team format
  const humanOpponentTeam = convertToOpponentTeam(humanTeam, tier);

  // Generate AI opponent teams (numTeams - 1 for human team)
  const opponentTeams: OpponentTeam[] = [];
  for (let i = 0; i < tierConfig.numTeams - 1; i++) {
    opponentTeams.push(generateOpponentTeam(tier));
  }

  const allTeams = [humanOpponentTeam, ...opponentTeams];

  // Generate schedule
  const schedule = generateSeasonSchedule(allTeams, tierConfig.gamesPerOpponent);

  // Initialize standings
  const standings = initializeStandings(allTeams);

  return {
    id: generateId(),
    tier,
    season,
    teams: allTeams,
    humanTeamId: humanOpponentTeam.id,
    schedule,
    standings,
    currentWeek: 0,
    totalWeeks: schedule.weeks.length,
    isComplete: false,
  };
}
