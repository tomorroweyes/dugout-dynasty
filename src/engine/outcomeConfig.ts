import { PlayOutcome } from "@/types/game";
import { GAME_CONSTANTS } from "./constants";
import { RandomProvider } from "./randomProvider";
import { getTrace } from "./traceContext";

/**
 * Base runner advancement rules for an outcome
 * Function receives current bases and returns new base state and runs scored
 */
export type BaseAdvancement = (bases: [boolean, boolean, boolean]) => {
  newBases: [boolean, boolean, boolean];
  runsScored: number;
};

/**
 * Configuration for each play outcome type
 * Centralizes all game logic and display strings for maintainability
 */
export interface OutcomeConfig {
  /** Display text for play-by-play */
  displayText: string;

  /** Alternative display texts for variety (randomly selected) */
  displayVariants?: string[];

  /** Whether this counts as an official at-bat */
  countsAsAtBat: boolean;

  /** Whether this is a hit */
  isHit: boolean;

  /** Whether this results in an out */
  isOut: boolean;

  /** Whether this is a strikeout (for K stats) */
  isStrikeout: boolean;

  /** Whether this is a walk (for BB stats) */
  isWalk: boolean;

  /** How bases advance and runs score */
  advanceBases: BaseAdvancement;

  /** Whether the batter reaches base (and which base: 1, 2, 3, or 4 for home) */
  batterReachesBase?: 1 | 2 | 3 | 4;

  /** UI color classification: positive (green), negative (red), or neutral */
  colorType: "positive" | "negative" | "neutral";

  /** The key word in display text to highlight (for text coloring) */
  highlightWord: string;
}

/**
 * Base advancement functions
 */
const BaseAdvancementRules = {
  /** No advancement - outs, strikeouts */
  none: (): { newBases: [boolean, boolean, boolean]; runsScored: number } => ({
    newBases: [false, false, false],
    runsScored: 0,
  }),

  /** Walk/HBP - force advance only */
  walk: (bases: [boolean, boolean, boolean]) => {
    const [first, second, third] = bases;
    let runsScored = 0;

    // Force runners forward if bases loaded
    if (third && second && first) {
      runsScored = 1;
    }

    return {
      newBases: [
        true, // Batter to first
        first || second, // First to second if occupied
        (first && second) || third, // Second to third if both occupied
      ] as [boolean, boolean, boolean],
      runsScored,
    };
  },

  /** Single - advance all runners 1-2 bases */
  single: (bases: [boolean, boolean, boolean]) => {
    const [first, second, third] = bases;
    let runsScored = 0;

    if (third) runsScored++; // Runner on third scores

    return {
      newBases: [
        true, // Batter to first
        first, // Runner on first to second
        second, // Runner on second to third
      ] as [boolean, boolean, boolean],
      runsScored,
    };
  },

  /** Double - advance all runners 2+ bases */
  double: (bases: [boolean, boolean, boolean]) => {
    const [first, second, third] = bases;
    let runsScored = 0;

    if (third) runsScored++; // Third scores
    if (second) runsScored++; // Second scores

    return {
      newBases: [
        false, // Clear first
        true, // Batter to second
        first, // First to third
      ] as [boolean, boolean, boolean],
      runsScored,
    };
  },

  /** Triple - all runners score */
  triple: (bases: [boolean, boolean, boolean]) => {
    const runsScored = bases.filter((b) => b).length;

    return {
      newBases: [false, false, true] as [boolean, boolean, boolean],
      runsScored,
    };
  },

  /** Home run - everyone scores */
  homerun: (bases: [boolean, boolean, boolean]) => {
    const runsScored = bases.filter((b) => b).length + 1; // All runners + batter

    return {
      newBases: [false, false, false] as [boolean, boolean, boolean],
      runsScored,
    };
  },

  /** Outs - no advancement, bases stay the same */
  out: (bases: [boolean, boolean, boolean]) => ({
    newBases: [...bases] as [boolean, boolean, boolean],
    runsScored: 0,
  }),
};

/**
 * Complete outcome configuration
 * Add new outcome types here with all their properties
 */
export const OUTCOME_CONFIG: Record<PlayOutcome, OutcomeConfig> = {
  strikeout: {
    displayText: "goes down",
    displayVariants: [
      "goes down swinging",
      "goes down looking",
      "goes down on strikes",
    ],
    countsAsAtBat: true,
    isHit: false,
    isOut: true,
    isStrikeout: true,
    isWalk: false,
    advanceBases: BaseAdvancementRules.out,
    colorType: "negative",
    highlightWord: "goes down",
  },

  walk: {
    displayText: "walks",
    displayVariants: ["draws a walk", "works a walk", "takes ball four"],
    countsAsAtBat: false,
    isHit: false,
    isOut: false,
    isStrikeout: false,
    isWalk: true,
    advanceBases: BaseAdvancementRules.walk,
    batterReachesBase: 1,
    colorType: "positive",
    highlightWord: "walk",
  },

  single: {
    displayText: "singles",
    displayVariants: ["hits a single", "slaps a single", "pokes a single"],
    countsAsAtBat: true,
    isHit: true,
    isOut: false,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.single,
    batterReachesBase: 1,
    colorType: "positive",
    highlightWord: "single",
  },

  double: {
    displayText: "doubles",
    displayVariants: ["rips a double", "drives a double", "hits a two-bagger"],
    countsAsAtBat: true,
    isHit: true,
    isOut: false,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.double,
    batterReachesBase: 2,
    colorType: "positive",
    highlightWord: "double",
  },

  triple: {
    displayText: "triples",
    displayVariants: [
      "smacks a triple",
      "legs out a triple",
      "hits a three-bagger",
    ],
    countsAsAtBat: true,
    isHit: true,
    isOut: false,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.triple,
    batterReachesBase: 3,
    colorType: "positive",
    highlightWord: "triple",
  },

  homerun: {
    displayText: "homers",
    displayVariants: [
      "crushes a home run",
      "goes yard",
      "launches one",
      "hits it out",
    ],
    countsAsAtBat: true,
    isHit: true,
    isOut: false,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.homerun,
    batterReachesBase: 4,
    colorType: "positive",
    highlightWord: "home run",
  },

  groundout: {
    displayText: "rolls one",
    displayVariants: [
      "rolls one to the infield",
      "bounces one",
      "hits a grounder",
    ],
    countsAsAtBat: true,
    isHit: false,
    isOut: true,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.out,
    colorType: "negative",
    highlightWord: "rolls one",
  },

  flyout: {
    displayText: "flies out",
    displayVariants: [
      "flies out to the outfield",
      "lifts a fly ball for an out",
      "skies one for an out",
    ],
    countsAsAtBat: true,
    isHit: false,
    isOut: true,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.out,
    colorType: "negative",
    highlightWord: "out",
  },

  lineout: {
    displayText: "lines out",
    displayVariants: [
      "hits a line drive right at someone",
      "smokes one for an out",
      "lines into an out",
    ],
    countsAsAtBat: true,
    isHit: false,
    isOut: true,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.out,
    colorType: "negative",
    highlightWord: "out",
  },

  popout: {
    displayText: "pops up",
    displayVariants: ["pops up", "hits a pop fly", "lifts one up"],
    countsAsAtBat: true,
    isHit: false,
    isOut: true,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.out,
    colorType: "negative",
    highlightWord: "pops up",
  },

  // Legacy fallback
  out: {
    displayText: "out",
    countsAsAtBat: true,
    isHit: false,
    isOut: true,
    isStrikeout: false,
    isWalk: false,
    advanceBases: BaseAdvancementRules.out,
    colorType: "negative",
    highlightWord: "out",
  },
};

/**
 * Get the color type for an outcome (for UI styling)
 */
export function getOutcomeColorType(
  outcome: PlayOutcome
): "positive" | "negative" | "neutral" {
  return OUTCOME_CONFIG[outcome]?.colorType ?? "neutral";
}

/**
 * Get the CSS classes for an outcome based on its color type
 */
export function getOutcomeColorClass(outcome: PlayOutcome): string {
  const colorType = getOutcomeColorType(outcome);
  switch (colorType) {
    case "positive":
      return "text-green-600 dark:text-green-400 font-semibold";
    case "negative":
      return "text-red-600 dark:text-red-400 font-semibold";
    default:
      return "";
  }
}

/**
 * Get the highlight word for an outcome (for text highlighting in UI)
 */
export function getOutcomeHighlightWord(outcome: PlayOutcome): string {
  return OUTCOME_CONFIG[outcome]?.highlightWord ?? outcome;
}

/**
 * Get display text for an outcome (with optional RBI info)
 * Randomly selects from variants if available
 */
export function getOutcomeDisplayText(
  outcome: PlayOutcome,
  rbi?: number
): string {
  const config = OUTCOME_CONFIG[outcome];
  if (!config) return outcome;

  // Select display text (use variant if available)
  let text = config.displayText;
  if (config.displayVariants && config.displayVariants.length > 0) {
    const allOptions = [config.displayText, ...config.displayVariants];
    text = allOptions[Math.floor(Math.random() * allOptions.length)];
  }

  // Add RBI info if applicable
  if (rbi && rbi > 0) {
    text += `, ${rbi} RBI`;
  }

  return text;
}

/**
 * Apply outcome effects to game state
 * Returns updated stats and game state
 */
export function applyOutcome(
  outcome: PlayOutcome,
  bases: [boolean, boolean, boolean],
  batterStats: {
    hits: number;
    abs: number;
    strikeouts: number;
    walks: number;
    runs: number;
    rbis: number;
  },
  pitcherStats: {
    hitsAllowed: number;
    runsAllowed: number;
    strikeouts: number;
    walks: number;
  },
  outs: number
): {
  batterStats: typeof batterStats;
  pitcherStats: typeof pitcherStats;
  bases: [boolean, boolean, boolean];
  outs: number;
  runsScored: number;
} {
  const config = OUTCOME_CONFIG[outcome];
  const { newBases, runsScored } = config.advanceBases(bases);

  // Update batter stats
  const newBatterStats = { ...batterStats };
  if (config.countsAsAtBat) newBatterStats.abs++;
  if (config.isHit) newBatterStats.hits++;
  if (config.isStrikeout) newBatterStats.strikeouts++;
  if (config.isWalk) newBatterStats.walks++;
  if (config.batterReachesBase === 4) newBatterStats.runs++; // Batter scored
  newBatterStats.rbis += runsScored;

  // Update pitcher stats
  const newPitcherStats = { ...pitcherStats };
  if (config.isHit) newPitcherStats.hitsAllowed++;
  if (config.isStrikeout) newPitcherStats.strikeouts++;
  if (config.isWalk) newPitcherStats.walks++;
  newPitcherStats.runsAllowed += runsScored;

  // Update outs
  const newOuts = config.isOut ? outs + 1 : outs;

  return {
    batterStats: newBatterStats,
    pitcherStats: newPitcherStats,
    bases: newBases,
    outs: newOuts,
    runsScored,
  };
}

// ============================================
// SPEED-BASED BASERUNNING
// ============================================

/**
 * Tracks which player is on each base (by index into offense array)
 */
export type BaseRunnerIds = [string | null, string | null, string | null];

/**
 * Result of a speed-based extra base attempt
 */
export interface ExtraBaseResult {
  bases: [boolean, boolean, boolean];
  baseRunnerIds: BaseRunnerIds;
  extraRuns: number;
  thrownOut: boolean;
  narrative?: string; // e.g. "Jones advances to 3rd!" or "Jones thrown out at home!"
}

/**
 * Calculate the chance a runner attempts to take an extra base
 * Based on runner speed, with 2-out bonus
 */
function calculateAttemptChance(runnerSpeed: number, outs: number): number {
  const cfg = GAME_CONSTANTS.BASERUNNING;
  let chance = cfg.BASE_ATTEMPT_CHANCE + (runnerSpeed - 50) * cfg.SPEED_ATTEMPT_SCALE;

  if (outs === 2) {
    chance += cfg.TWO_OUT_ATTEMPT_BONUS;
  }

  return Math.max(cfg.MIN_ATTEMPT_CHANCE, Math.min(cfg.MAX_ATTEMPT_CHANCE, chance));
}

/**
 * Calculate the chance a runner is safe when attempting an extra base
 * Based on runner speed vs defense glove rating
 */
function calculateSuccessChance(runnerSpeed: number, defenseGlove: number): number {
  const cfg = GAME_CONSTANTS.BASERUNNING;
  const chance = cfg.BASE_SUCCESS_CHANCE + (runnerSpeed - defenseGlove) * cfg.SPEED_SUCCESS_SCALE;
  return Math.max(cfg.MIN_SUCCESS_CHANCE, Math.min(cfg.MAX_SUCCESS_CHANCE, chance));
}

/**
 * Resolve speed-based extra base attempts after standard advancement.
 *
 * Called after applyOutcome to check if any runners try for an additional base.
 * Only applies on singles and doubles where runners have room to advance.
 *
 * Possible scenarios:
 * - Single: runner on 2nd can try to score, runner on 1st can try for 3rd
 * - Double: runner on 1st can try to score (instead of stopping at 3rd)
 *
 * @param outcome - The at-bat result
 * @param basesBeforeHit - Base state BEFORE the standard advancement
 * @param basesAfterHit - Base state AFTER the standard advancement
 * @param baseRunnerIds - Player IDs on each base AFTER standard advancement
 * @param runnerSpeedLookup - Function to get speed for a player ID
 * @param defenseGlove - Average defensive glove rating
 * @param outs - Current outs AFTER the at-bat
 * @param rng - Random provider
 */
export function resolveExtraBaseAttempts(
  outcome: PlayOutcome,
  basesBeforeHit: [boolean, boolean, boolean],
  basesAfterHit: [boolean, boolean, boolean],
  baseRunnerIds: BaseRunnerIds,
  runnerSpeedLookup: (id: string) => number,
  defenseGlove: number,
  outs: number,
  rng: RandomProvider
): ExtraBaseResult {
  const newBases: [boolean, boolean, boolean] = [...basesAfterHit];
  const newRunnerIds: BaseRunnerIds = [...baseRunnerIds];
  let extraRuns = 0;
  let thrownOut = false;
  const narratives: string[] = [];

  // Only check on singles and doubles — triples/HRs already maximize advancement
  // Also skip if already 3 outs (inning over)
  if (outs >= 3) {
    return { bases: newBases, baseRunnerIds: newRunnerIds, extraRuns, thrownOut };
  }

  if (outcome === "single") {
    // On a single, standard advancement puts:
    // - Runner who was on 2nd → now on 3rd (index 2)
    // - Runner who was on 1st → now on 2nd (index 1)
    //
    const trace = getTrace();

    // Speed check 1: Runner now on 3rd (was on 2nd) tries to score
    if (basesBeforeHit[1] && newBases[2] && newRunnerIds[2] && !thrownOut) {
      const runnerId = newRunnerIds[2];
      const speed = runnerSpeedLookup(runnerId);
      const attemptChance = calculateAttemptChance(speed, outs);
      const attemptRaw = rng.random();
      const attemptRoll = attemptRaw * 100;

      if (attemptRoll < attemptChance) {
        const successChance = calculateSuccessChance(speed, defenseGlove);
        const successRaw = rng.random();
        const successRoll = successRaw * 100;
        if (successRoll < successChance) {
          // Safe! Runner scores from 3rd
          newBases[2] = false;
          newRunnerIds[2] = null;
          extraRuns++;
          narratives.push(`scores from 2nd on the single`);
          trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "3rd", toBase: "home", attemptChance, attemptRoll, attempted: true, successChance, successRoll, succeeded: true });
        } else {
          // Thrown out at home!
          newBases[2] = false;
          newRunnerIds[2] = null;
          thrownOut = true;
          narratives.push(`thrown out at home trying to score`);
          trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "3rd", toBase: "home", attemptChance, attemptRoll, attempted: true, successChance, successRoll, succeeded: false });
        }
      } else {
        trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "3rd", toBase: "home", attemptChance, attemptRoll, attempted: false });
      }
    }

    // Speed check 2: Runner now on 2nd (was on 1st) tries for 3rd
    // Only if 3rd base is now open (runner scored or was thrown out)
    if (basesBeforeHit[0] && newBases[1] && newRunnerIds[1] && !newBases[2] && !thrownOut) {
      const runnerId = newRunnerIds[1];
      const speed = runnerSpeedLookup(runnerId);
      const attemptChance = calculateAttemptChance(speed, outs);
      const attemptRaw = rng.random();
      const attemptRoll = attemptRaw * 100;

      if (attemptRoll < attemptChance) {
        const successChance = calculateSuccessChance(speed, defenseGlove);
        const successRaw = rng.random();
        const successRoll = successRaw * 100;
        if (successRoll < successChance) {
          // Safe at 3rd!
          newBases[2] = true;
          newRunnerIds[2] = runnerId;
          newBases[1] = false;
          newRunnerIds[1] = null;
          narratives.push(`advances 1st to 3rd on the single`);
          trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "2nd", toBase: "3rd", attemptChance, attemptRoll, attempted: true, successChance, successRoll, succeeded: true });
        } else {
          // Thrown out at 3rd!
          newBases[1] = false;
          newRunnerIds[1] = null;
          thrownOut = true;
          narratives.push(`thrown out at 3rd trying to advance`);
          trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "2nd", toBase: "3rd", attemptChance, attemptRoll, attempted: true, successChance, successRoll, succeeded: false });
        }
      } else {
        trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "2nd", toBase: "3rd", attemptChance, attemptRoll, attempted: false });
      }
    }
  }

  if (outcome === "double") {
    const trace = getTrace();

    // On a double, standard advancement puts:
    // - Runner who was on 1st → now on 3rd (index 2)
    //
    // Speed check: Runner now on 3rd (was on 1st) tries to score
    if (basesBeforeHit[0] && newBases[2] && newRunnerIds[2] && !thrownOut) {
      const runnerId = newRunnerIds[2];
      const speed = runnerSpeedLookup(runnerId);
      const attemptChance = calculateAttemptChance(speed, outs);
      const attemptRaw = rng.random();
      const attemptRoll = attemptRaw * 100;

      if (attemptRoll < attemptChance) {
        const successChance = calculateSuccessChance(speed, defenseGlove);
        const successRaw = rng.random();
        const successRoll = successRaw * 100;
        if (successRoll < successChance) {
          // Safe! Runner scores from 1st on the double
          newBases[2] = false;
          newRunnerIds[2] = null;
          extraRuns++;
          narratives.push(`scores from 1st on the double`);
          trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "3rd", toBase: "home", attemptChance, attemptRoll, attempted: true, successChance, successRoll, succeeded: true });
        } else {
          // Thrown out at home!
          newBases[2] = false;
          newRunnerIds[2] = null;
          thrownOut = true;
          narratives.push(`thrown out at home trying to score from 1st`);
          trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "3rd", toBase: "home", attemptChance, attemptRoll, attempted: true, successChance, successRoll, succeeded: false });
        }
      } else {
        trace?.logExtraBase({ runnerId, runnerSpeed: speed, defenseGlove, fromBase: "3rd", toBase: "home", attemptChance, attemptRoll, attempted: false });
      }
    }
  }

  return {
    bases: newBases,
    baseRunnerIds: newRunnerIds,
    extraRuns,
    thrownOut,
    narrative: narratives.length > 0 ? narratives.join("; ") : undefined,
  };
}
