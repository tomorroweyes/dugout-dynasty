import {
  Player,
  Team,
  isBatter,
  isPitcher,
  PlayByPlayEvent,
  MatchResult,
} from "@/types/game";
import { simulateAtBat } from "./atBatSimulator";
import { applyOutcome, resolveExtraBaseAttempts, BaseRunnerIds } from "./outcomeConfig";
import { calculatePlayerStatsWithEquipment } from "./itemStatsCalculator";
import { BatterStats } from "@/types/game";
import { generateNarrativeText, generateSituationalFlavor } from "./narrativeEngine";
import { generateItem, shouldDropLoot } from "./lootGenerator";
import { LootDrop } from "@/types/item";
import { RandomProvider, getDefaultRandomProvider, SeededRandomProvider } from "./randomProvider";
import type { ActiveAbilityContext } from "@/types/ability";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import { BATTER_APPROACHES, PITCH_STRATEGIES } from "./approachConfig";
import type { ZoneModifier } from "./zoneSystem";
import { GAME_CONSTANTS } from "./constants";
import { processAbilityActivation } from "./abilityAI";
import { GameTraceCollector, setActiveTrace, getTrace } from "./traceContext";

/**
 * Interactive Match Engine
 *
 * Allows stepping through a match one at-bat at a time,
 * pausing for player input (ability selection).
 */

/** Coarse pitcher fatigue level derived from innings pitched and accumulated extra fatigue. */
export type PitcherFatigueLevel = "fresh" | "tired" | "gassed";

/**
 * Derive a human-readable fatigue level from raw fatigue numbers.
 * Thresholds:
 *   fresh  → innings < 4 AND extraFatigue < 0.5
 *   gassed → innings >= 6 OR extraFatigue >= 1.5
 *   tired  → everything in between
 */
export function derivePitcherFatigueLevel(
  innings: number,
  extraFatigue: number
): PitcherFatigueLevel {
  if (innings >= 6 || extraFatigue >= 1.5) return "gassed";
  if (innings < 4 && extraFatigue < 0.5) return "fresh";
  return "tired";
}

export interface InteractiveMatchState {
  // Teams
  myTeam: Player[];
  opponentTeam: Player[];
  myTeamColor?: string;
  opponentTeamColor?: string;

  // Current inning
  inning: number;
  isTop: boolean; // true = top (opponent batting), false = bottom (my team batting)

  // Current pitcher
  myPitcher: Player;
  myPitcherInnings: number;
  opponentPitcher: Player;
  opponentPitcherInnings: number;
  /** Derived fatigue level for each pitcher — updated after every AB. */
  myPitcherFatigueLevel: PitcherFatigueLevel;
  opponentPitcherFatigueLevel: PitcherFatigueLevel;

  // Current at-bat state
  outs: number;
  bases: [boolean, boolean, boolean]; // 1st, 2nd, 3rd
  baseRunnerIds: BaseRunnerIds; // Track which player is on each base
  currentBatter: Player;
  currentPitcher: Player;
  batterIndex: number;
  // Persistent batting order positions — survive inning transitions
  myBatterIndex: number;
  opponentBatterIndex: number;

  // Score
  myRuns: number;
  opponentRuns: number;

  // Stats tracking
  myHits: number;
  opponentHits: number;
  playByPlay: PlayByPlayEvent[];
  lootDrops: LootDrop[];

  // Match status
  isComplete: boolean;
  inningComplete: boolean;

  // RNG
  rng: RandomProvider;

  // Accumulated extra fatigue from Patient at-bats and Paint self-cost
  myPitcherExtraFatigue: number;
  opponentPitcherExtraFatigue: number;

  // Adaptation tracking (per half-inning, resets on transitions)
  lastBatterApproach: BatterApproach | null;
  consecutiveBatterApproach: number;
  lastPitchStrategy: PitchStrategy | null;
  consecutivePitchStrategy: number;

  // Last spirit delta for UI display
  lastSpiritDelta?: { batterId?: string; pitcherId?: string; batterDelta?: number; pitcherDelta?: number; teamDelta?: number };

  // Engine trace collector (when trace is enabled)
  trace?: GameTraceCollector;
}

export interface AtBatDecision {
  batterAbility?: ActiveAbilityContext;
  pitcherAbility?: ActiveAbilityContext;
  batterApproach?: BatterApproach;
  pitchStrategy?: PitchStrategy;
  zoneResult?: ZoneModifier;
}

/**
 * Apply a spirit delta to a player, clamping to [0, max]
 */
function applySpiritDelta(player: Player, delta: number): Player {
  if (!player.spirit || delta === 0) return player;
  return {
    ...player,
    spirit: {
      ...player.spirit,
      current: Math.max(0, Math.min(player.spirit.max, player.spirit.current + delta)),
    },
  };
}

/**
 * Calculate spirit deltas for batter and pitcher based on at-bat outcome
 */
function calculateSpiritDeltas(
  result: string,
  runsScored: number
): { batterDelta: number; pitcherDelta: number; teamDelta: number } {
  const M = GAME_CONSTANTS.SPIRIT_MOMENTUM;
  let batterDelta = 0;
  let pitcherDelta = 0;
  let teamDelta = 0;

  switch (result) {
    case "single":
      batterDelta = M.SINGLE;
      pitcherDelta = M.PITCH_HIT_ALLOWED;
      break;
    case "double":
      batterDelta = M.DOUBLE;
      pitcherDelta = M.PITCH_HIT_ALLOWED;
      break;
    case "triple":
      batterDelta = M.TRIPLE;
      pitcherDelta = M.PITCH_HIT_ALLOWED;
      break;
    case "homerun":
      batterDelta = M.HOMERUN;
      pitcherDelta = M.PITCH_HR_ALLOWED;
      break;
    case "walk":
      batterDelta = M.WALK;
      pitcherDelta = M.PITCH_WALK_ALLOWED;
      break;
    case "strikeout":
      batterDelta = M.STRIKEOUT;
      pitcherDelta = M.PITCH_STRIKEOUT;
      break;
    case "groundout":
      pitcherDelta = M.PITCH_GROUNDOUT;
      break;
    case "flyout":
      pitcherDelta = M.PITCH_FLYOUT;
      break;
    case "lineout":
      pitcherDelta = M.PITCH_LINEOUT;
      break;
    case "popout":
      pitcherDelta = M.PITCH_POPOUT;
      break;
  }

  // RBI bonus to batter
  if (runsScored > 0) {
    batterDelta += M.RBI_BONUS * runsScored;
    // Runs allowed penalty to pitcher
    pitcherDelta += M.PITCH_RUN_ALLOWED * runsScored;
    // Team-wide bonus when runs score
    teamDelta = M.TEAM_RUN_SCORED * runsScored;
  }

  return { batterDelta, pitcherDelta, teamDelta };
}

/**
 * Get adaptation penalty multiplier based on consecutive same-approach count
 */
function getAdaptationMultiplier(consecutiveCount: number): number {
  const scale = GAME_CONSTANTS.ADAPTATION.PENALTY_SCALE;
  const idx = Math.min(Math.max(consecutiveCount - 1, 0), scale.length - 1);
  return scale[idx];
}

/**
 * Apply spirit delta to a player within a team array, returning updated team
 */
function applyTeamSpiritDelta(team: Player[], playerId: string, delta: number): Player[] {
  if (delta === 0) return team;
  const idx = team.findIndex((p) => p.id === playerId);
  if (idx === -1) return team;
  const updated = [...team];
  updated[idx] = applySpiritDelta(updated[idx], delta);
  return updated;
}

/**
 * Apply spirit delta to ALL players in a team
 */
function applyTeamWideSpiritDelta(team: Player[], delta: number): Player[] {
  if (delta === 0) return team;
  return team.map((p) => applySpiritDelta(p, delta));
}

/**
 * Resolve pitcher rotation based on innings pitched.
 * Applies PITCHER_ROTATION thresholds: starter → first reliever → second reliever.
 */
function resolveNextPitcher(team: Player[], currentPitcher: Player, inningsCompleted: number): Player {
  const { FIRST_RELIEVER_INNING, SECOND_RELIEVER_INNING } = GAME_CONSTANTS.PITCHER_ROTATION;
  const pitchers = team.filter(isPitcher);
  if (pitchers.length <= 1) return currentPitcher;
  if (inningsCompleted >= SECOND_RELIEVER_INNING && pitchers.length >= 3) return pitchers[2];
  if (inningsCompleted >= FIRST_RELIEVER_INNING && pitchers.length >= 2) return pitchers[1];
  return currentPitcher;
}

/**
 * Initialize a new interactive match
 */
export function initializeInteractiveMatch(
  myTeam: Team,
  opponentTeam: Team,
  seed?: number,
  enableTrace: boolean = false
): InteractiveMatchState {
  const rng = seed !== undefined
    ? new SeededRandomProvider(seed)
    : enableTrace
    ? new SeededRandomProvider(Date.now())
    : getDefaultRandomProvider();

  const trace = enableTrace ? new GameTraceCollector() : undefined;
  if (trace && rng instanceof SeededRandomProvider) {
    trace.seed = Date.now();
  }

  const myBatters = myTeam.roster.filter(isBatter);
  const myPitchers = myTeam.roster.filter(isPitcher);
  const opponentBatters = opponentTeam.roster.filter(isBatter);
  const opponentPitchers = opponentTeam.roster.filter(isPitcher);

  const myPitcher = myPitchers[0]; // Start with first starter
  const opponentPitcher = opponentPitchers[0];

  return {
    myTeam: myTeam.roster,
    opponentTeam: opponentTeam.roster,
    myTeamColor: myTeam.colors?.primary,
    opponentTeamColor: opponentTeam.colors?.primary,
    inning: 1,
    isTop: true, // Opponent bats first (top of 1st)
    myPitcher,
    myPitcherInnings: 0,
    opponentPitcher,
    opponentPitcherInnings: 0,
    outs: 0,
    bases: [false, false, false],
    baseRunnerIds: [null, null, null],
    currentBatter: opponentBatters[0],
    currentPitcher: myPitcher,
    batterIndex: 0,
    myBatterIndex: 0,
    opponentBatterIndex: 0,
    myRuns: 0,
    opponentRuns: 0,
    myHits: 0,
    opponentHits: 0,
    playByPlay: [],
    lootDrops: [],
    isComplete: false,
    inningComplete: false,
    rng,
    myPitcherExtraFatigue: 0,
    opponentPitcherExtraFatigue: 0,
    myPitcherFatigueLevel: "fresh",
    opponentPitcherFatigueLevel: "fresh",
    lastBatterApproach: null,
    consecutiveBatterApproach: 0,
    lastPitchStrategy: null,
    consecutivePitchStrategy: 0,
    trace,
  };
}

/**
 * Simulate the current at-bat and advance match state
 */
export function simulateAtBat_Interactive(
  state: InteractiveMatchState,
  decision: AtBatDecision
): InteractiveMatchState {
  const { currentBatter, currentPitcher, outs, bases, isTop, rng } = state;

  // Activate trace context for this at-bat (beginAtBat now, logApproach after adaptation is computed)
  if (state.trace) {
    setActiveTrace(state.trace);
    state.trace.beginAtBat({
      inning: state.inning,
      isTop,
      batterId: currentBatter.id,
      batterName: currentBatter.name,
      pitcherId: currentPitcher.id,
      pitcherName: currentPitcher.name,
      outsBefore: outs,
      basesBefore: [...bases] as [boolean, boolean, boolean],
    });
  }

  // Get the defending team for defense stat
  const defense = isTop ? state.myTeam : state.opponentTeam;

  // Pitcher innings pitched (for fatigue)
  const pitcherInnings = isTop ? state.myPitcherInnings : state.opponentPitcherInnings;

  // Extra fatigue accumulated from Patient at-bats and Paint self-cost
  const extraFatigue = isTop ? state.myPitcherExtraFatigue : state.opponentPitcherExtraFatigue;

  // Calculate adaptation multipliers
  let newConsecutiveBatter = state.consecutiveBatterApproach;
  let newLastBatterApproach = state.lastBatterApproach;
  if (decision.batterApproach) {
    if (decision.batterApproach === state.lastBatterApproach) {
      newConsecutiveBatter = state.consecutiveBatterApproach + 1;
    } else {
      newConsecutiveBatter = 1;
    }
    newLastBatterApproach = decision.batterApproach;
  }

  let newConsecutiveStrategy = state.consecutivePitchStrategy;
  let newLastPitchStrategy = state.lastPitchStrategy;
  if (decision.pitchStrategy) {
    if (decision.pitchStrategy === state.lastPitchStrategy) {
      newConsecutiveStrategy = state.consecutivePitchStrategy + 1;
    } else {
      newConsecutiveStrategy = 1;
    }
    newLastPitchStrategy = decision.pitchStrategy;
  }

  const approachAdaptation = getAdaptationMultiplier(newConsecutiveBatter);
  const strategyAdaptation = getAdaptationMultiplier(newConsecutiveStrategy);

  // Trace: log approach/abilities now that adaptation is computed
  if (state.trace) {
    state.trace.logApproach({
      batterApproach: decision.batterApproach,
      pitchStrategy: decision.pitchStrategy,
      approachAdaptation,
      strategyAdaptation,
      consecutiveBatterApproach: newConsecutiveBatter,
      consecutivePitchStrategy: newConsecutiveStrategy,
    });
    state.trace.logAbilities({
      batterPassive: null,
      batterActive: decision.batterAbility ?? null,
      batterMerged: decision.batterAbility ?? null,
      pitcherPassive: null,
      pitcherActive: decision.pitcherAbility ?? null,
      pitcherMerged: decision.pitcherAbility ?? null,
    });
  }

  // Simulate the at-bat with abilities, approach/strategy, fatigue, adaptation, and zone modifier
  let { result, clashOccurred } = simulateAtBat(
    currentBatter,
    currentPitcher,
    defense,
    pitcherInnings,
    rng,
    decision.batterAbility,
    decision.pitcherAbility,
    decision.batterApproach,
    decision.pitchStrategy,
    extraFatigue,
    approachAdaptation,
    strategyAdaptation,
    undefined, // offenseSynergies (not used in interactive path)
    undefined, // defenseSynergies
    decision.zoneResult
      ? {
          strikeoutBonus: decision.zoneResult.strikeoutBonus,
          hitBonus: decision.zoneResult.hitBonus,
          homerunBonus: decision.zoneResult.homerunBonus,
          walkBonus: decision.zoneResult.walkBonus,
        }
      : undefined
  );

  // Natural 20: guaranteed outcome bump when zone read was perfect
  const isPerfectZone = decision.zoneResult?.isPerfect ?? false;
  if (isPerfectZone) {
    if (!isTop) {
      // Batting nat 20 — bump batter result one tier up
      if (result === "strikeout" || result === "groundout" || result === "flyout" || result === "lineout" || result === "popout") {
        result = "single";
      } else if (result === "single") {
        result = "double";
      }
    } else {
      // Pitching nat 20 — bump pitcher result one tier in pitcher's favour
      if (result === "single" || result === "double" || result === "triple") {
        result = "groundout";
      } else if (result === "groundout" || result === "flyout" || result === "lineout" || result === "popout") {
        result = "strikeout";
      }
    }
  }

  // Apply outcome to bases/outs
  const simplifiedBatterStats = {
    hits: 0,
    abs: 0,
    strikeouts: 0,
    walks: 0,
    runs: 0,
    rbis: 0,
  };
  const simplifiedPitcherStats = {
    hitsAllowed: 0,
    runsAllowed: 0,
    strikeouts: 0,
    walks: 0,
  };

  const outcomeResult = applyOutcome(
    result,
    bases,
    simplifiedBatterStats,
    simplifiedPitcherStats,
    outs
  );

  let newOuts = outcomeResult.outs;
  let newBases = outcomeResult.bases;
  const runsScored = outcomeResult.runsScored;

  // Advance runner IDs
  const basesBeforeHit: [boolean, boolean, boolean] = [...bases];
  const advanceRunnerIdsFn = (outcome: string, rIds: BaseRunnerIds, bId: string): BaseRunnerIds => {
    const [r1, r2, r3] = rIds;
    switch (outcome) {
      case "walk": return [bId, r1 || r2, (r1 && r2 ? r2 : null) || r3] as BaseRunnerIds;
      case "single": return [bId, r1, r2] as BaseRunnerIds;
      case "double": return [null, bId, r1] as BaseRunnerIds;
      case "triple": return [null, null, bId] as BaseRunnerIds;
      case "homerun": return [null, null, null] as BaseRunnerIds;
      default: return [...rIds] as BaseRunnerIds;
    }
  };
  let newRunnerIds = advanceRunnerIdsFn(result, state.baseRunnerIds, currentBatter.id);

  // Speed-based extra base attempts
  let speedNarrative: string | undefined;
  let extraRunsFromSpeed = 0;
  if ((result === "single" || result === "double") && newOuts < 3) {
    const offense = isTop ? state.opponentTeam : state.myTeam;
    const speedLookup = (id: string) => {
      const player = offense.find((p) => p.id === id);
      if (!player || !isBatter(player)) return 40;
      const stats = calculatePlayerStatsWithEquipment(player) as BatterStats;
      return stats.speed;
    };
    const defBatters = defense.filter(isBatter);
    const defGlove = defBatters.length > 0
      ? defBatters.reduce((sum, p) => sum + (calculatePlayerStatsWithEquipment(p) as BatterStats).glove, 0) / defBatters.length
      : 50;

    const extraBaseResult = resolveExtraBaseAttempts(
      result, basesBeforeHit, newBases, newRunnerIds, speedLookup, defGlove, newOuts, rng
    );
    newBases = extraBaseResult.bases;
    newRunnerIds = extraBaseResult.baseRunnerIds;
    extraRunsFromSpeed = extraBaseResult.extraRuns;
    speedNarrative = extraBaseResult.narrative;
    if (extraBaseResult.thrownOut) newOuts++;
  }

  // Update runs
  let newMyRuns = state.myRuns;
  let newOpponentRuns = state.opponentRuns;
  let newMyHits = state.myHits;
  let newOpponentHits = state.opponentHits;
  const totalRunsScored = runsScored + extraRunsFromSpeed;

  if (isTop) {
    newOpponentRuns += totalRunsScored;
    if (result === "single" || result === "double" || result === "triple" || result === "homerun") {
      newOpponentHits++;
    }
  } else {
    newMyRuns += totalRunsScored;
    if (result === "single" || result === "double" || result === "triple" || result === "homerun") {
      newMyHits++;
    }
  }

  // Generate narrative text with ability, approach/strategy, and zone context
  let narrativeText = generateNarrativeText(
    result,
    currentBatter,
    currentPitcher,
    newOuts,
    rng,
    decision.batterAbility,
    decision.pitcherAbility,
    clashOccurred,
    decision.batterApproach,
    decision.pitchStrategy,
    runsScored,
    isPerfectZone
      ? { perfectContact: !isTop, paintedCorner: isTop }
      : undefined
  );
  if (speedNarrative) {
    narrativeText = narrativeText
      ? `${narrativeText} — ${speedNarrative}`
      : speedNarrative;
  }

  // Prepend situational flavor for clutch moments (late innings, close game, runners on)
  const basesOccupied = state.bases.filter(Boolean).length;
  const offenseRuns = state.isTop ? state.opponentRuns : state.myRuns;
  const defenseRuns = state.isTop ? state.myRuns : state.opponentRuns;
  const situationalFlavor = generateSituationalFlavor(
    basesOccupied,
    { offense: offenseRuns, defense: defenseRuns },
    state.inning,
    rng
  );
  if (situationalFlavor) {
    narrativeText = situationalFlavor + (narrativeText ? `\n${narrativeText}` : "");
  }

  // Add to play-by-play
  const newPlayByPlay = [
    ...state.playByPlay,
    {
      inning: state.inning,
      isTop: state.isTop,
      batter: currentBatter.name,
      pitcher: currentPitcher.name,
      outcome: result,
      rbi: runsScored > 0 ? runsScored : undefined,
      outs: newOuts,
      narrativeText,
      batterApproach: decision.batterApproach,
      pitchStrategy: decision.pitchStrategy,
      batterAbilityUsed: !!decision.batterAbility,
      pitcherAbilityUsed: !!decision.pitcherAbility,
      perfectContact: isPerfectZone && !isTop ? true : undefined,
      paintedCorner: isPerfectZone && isTop ? true : undefined,
    } as PlayByPlayEvent,
  ];

  // Check for loot drops (only for my team's hits)
  const newLootDrops = [...state.lootDrops];
  if (!isTop && (result === "single" || result === "double" || result === "triple" || result === "homerun")) {
    if (shouldDropLoot(result, rng)) {
      const item = generateItem(currentBatter.role, currentBatter.level, rng);
      newLootDrops.push({
        item,
        triggeredBy: result,
        playerName: currentBatter.name,
      });
    }
  }

  // Process ability activation (deduct spirit)
  let updatedMyTeam = state.myTeam;
  let updatedOpponentTeam = state.opponentTeam;
  let updatedMyPitcher = state.myPitcher;
  let updatedOpponentPitcher = state.opponentPitcher;

  if (decision.batterAbility && !isTop) {
    // My batter used an ability
    const bIdx = updatedMyTeam.findIndex((p) => p.id === currentBatter.id);
    if (bIdx !== -1) {
      updatedMyTeam = [...updatedMyTeam];
      updatedMyTeam[bIdx] = processAbilityActivation(
        updatedMyTeam[bIdx],
        decision.batterAbility
      );
    }
  }

  if (decision.batterAbility && isTop) {
    // Opponent batter used an ability
    const bIdx = updatedOpponentTeam.findIndex((p) => p.id === currentBatter.id);
    if (bIdx !== -1) {
      updatedOpponentTeam = [...updatedOpponentTeam];
      updatedOpponentTeam[bIdx] = processAbilityActivation(
        updatedOpponentTeam[bIdx],
        decision.batterAbility
      );
    }
  }

  if (decision.pitcherAbility && isTop) {
    // My pitcher used an ability (defending against opponent batter)
    updatedMyPitcher = processAbilityActivation(updatedMyPitcher, decision.pitcherAbility);
    const pIdx = updatedMyTeam.findIndex((p) => p.id === updatedMyPitcher.id);
    if (pIdx !== -1) {
      updatedMyTeam = [...updatedMyTeam];
      updatedMyTeam[pIdx] = updatedMyPitcher;
    }
  }

  if (decision.pitcherAbility && !isTop) {
    // Opponent pitcher used an ability
    updatedOpponentPitcher = processAbilityActivation(updatedOpponentPitcher, decision.pitcherAbility);
    const pIdx = updatedOpponentTeam.findIndex((p) => p.id === updatedOpponentPitcher.id);
    if (pIdx !== -1) {
      updatedOpponentTeam = [...updatedOpponentTeam];
      updatedOpponentTeam[pIdx] = updatedOpponentPitcher;
    }
  }

  // ── Spirit Momentum ──
  // Calculate spirit deltas based on outcome
  const { batterDelta, pitcherDelta, teamDelta } = calculateSpiritDeltas(result, totalRunsScored);

  // Apply batter spirit delta
  if (batterDelta !== 0) {
    if (isTop) {
      updatedOpponentTeam = applyTeamSpiritDelta(updatedOpponentTeam, currentBatter.id, batterDelta);
    } else {
      updatedMyTeam = applyTeamSpiritDelta(updatedMyTeam, currentBatter.id, batterDelta);
    }
  }

  // Apply pitcher spirit delta
  if (pitcherDelta !== 0) {
    if (isTop) {
      // My pitcher is pitching
      updatedMyPitcher = applySpiritDelta(updatedMyPitcher, pitcherDelta);
      const pIdx = updatedMyTeam.findIndex((p) => p.id === updatedMyPitcher.id);
      if (pIdx !== -1) {
        updatedMyTeam = [...updatedMyTeam];
        updatedMyTeam[pIdx] = updatedMyPitcher;
      }
    } else {
      // Opponent pitcher is pitching
      updatedOpponentPitcher = applySpiritDelta(updatedOpponentPitcher, pitcherDelta);
      const pIdx = updatedOpponentTeam.findIndex((p) => p.id === updatedOpponentPitcher.id);
      if (pIdx !== -1) {
        updatedOpponentTeam = [...updatedOpponentTeam];
        updatedOpponentTeam[pIdx] = updatedOpponentPitcher;
      }
    }
  }

  // Apply team-wide spirit bonus when runs score (to the batting team)
  if (teamDelta !== 0) {
    if (isTop) {
      updatedOpponentTeam = applyTeamWideSpiritDelta(updatedOpponentTeam, teamDelta);
    } else {
      updatedMyTeam = applyTeamWideSpiritDelta(updatedMyTeam, teamDelta);
    }
  }

  // ── Extra Fatigue from Patient / Paint ──
  let newMyPitcherExtraFatigue = state.myPitcherExtraFatigue;
  let newOpponentPitcherExtraFatigue = state.opponentPitcherExtraFatigue;

  // Patient batter wears down the opposing pitcher
  if (decision.batterApproach === "patient") {
    const fatigueEffect = BATTER_APPROACHES.patient.fatigueEffect ?? 0;
    if (isTop) {
      // Opponent batter used Patient against MY pitcher
      newMyPitcherExtraFatigue += fatigueEffect;
    } else {
      // My batter used Patient against OPPONENT pitcher
      newOpponentPitcherExtraFatigue += fatigueEffect;
    }
  }

  // Paint strategy costs the pitcher extra fatigue
  if (decision.pitchStrategy === "paint") {
    const fatigueCost = PITCH_STRATEGIES.paint.fatigueCost ?? 0;
    if (isTop) {
      // My pitcher used Paint
      newMyPitcherExtraFatigue += fatigueCost;
    } else {
      // Opponent pitcher used Paint
      newOpponentPitcherExtraFatigue += fatigueCost;
    }
  }

  // Trace: spirit + end at-bat + clear context
  if (state.trace) {
    state.trace.logSpirit({ batterDelta, pitcherDelta, teamDelta });
    state.trace.endAtBat(result, totalRunsScored, newOuts, [...newBases] as [boolean, boolean, boolean]);
    setActiveTrace(null);
  }

  // Store spirit delta info for UI
  const lastSpiritDelta = {
    batterId: currentBatter.id,
    pitcherId: currentPitcher.id,
    batterDelta,
    pitcherDelta,
    teamDelta,
  };

  // Check if inning is over (3 outs)
  const inningComplete = newOuts >= 3;

  // Determine next state
  if (inningComplete) {
    // Move to next half-inning or next inning
    if (isTop) {
      // Was top of inning, move to bottom
      // Batting order: continue my team's lineup where it left off
      const myBatters = updatedMyTeam.filter(isBatter);
      const myStartIdx = state.myBatterIndex % (myBatters.length || 1);
      // Save opponent's batting order position for next time they bat
      const oppBatterCount = updatedOpponentTeam.filter(isBatter).length || 1;
      const nextOpponentBatterIndex = (state.batterIndex + 1) % oppBatterCount;
      // Opponent pitcher rotation: check if they need to swap for this bottom half
      const newMyPitcherInnings = state.myPitcherInnings + 1;
      const nextOpponentPitcher = resolveNextPitcher(
        updatedOpponentTeam, updatedOpponentPitcher, state.opponentPitcherInnings
      );
      return {
        ...state,
        myTeam: updatedMyTeam,
        opponentTeam: updatedOpponentTeam,
        myPitcher: updatedMyPitcher,
        opponentPitcher: nextOpponentPitcher,
        isTop: false,
        outs: 0,
        bases: [false, false, false],
        baseRunnerIds: [null, null, null],
        currentBatter: myBatters[myStartIdx],
        currentPitcher: nextOpponentPitcher,
        batterIndex: myStartIdx,
        myBatterIndex: state.myBatterIndex, // unchanged — will advance as at-bats happen
        opponentBatterIndex: nextOpponentBatterIndex,
        myRuns: newMyRuns,
        opponentRuns: newOpponentRuns,
        myHits: newMyHits,
        opponentHits: newOpponentHits,
        playByPlay: newPlayByPlay,
        lootDrops: newLootDrops,
        inningComplete: true,
        myPitcherInnings: newMyPitcherInnings,
        myPitcherExtraFatigue: newMyPitcherExtraFatigue,
        opponentPitcherExtraFatigue: newOpponentPitcherExtraFatigue,
        myPitcherFatigueLevel: derivePitcherFatigueLevel(newMyPitcherInnings, newMyPitcherExtraFatigue),
        opponentPitcherFatigueLevel: derivePitcherFatigueLevel(state.opponentPitcherInnings, newOpponentPitcherExtraFatigue),
        // Reset adaptation for new half-inning
        lastBatterApproach: null,
        consecutiveBatterApproach: 0,
        lastPitchStrategy: null,
        consecutivePitchStrategy: 0,
        lastSpiritDelta,
      };
    } else {
      // Was bottom of inning — opponent pitcher just completed this half
      // Hoist increment before isGameOver check so both branches use the correct count
      const newOpponentPitcherInnings = state.opponentPitcherInnings + 1;
      const isGameOver = state.inning >= 9 && newMyRuns !== newOpponentRuns;

      if (isGameOver) {
        return {
          ...state,
          myTeam: updatedMyTeam,
          opponentTeam: updatedOpponentTeam,
          myRuns: newMyRuns,
          opponentRuns: newOpponentRuns,
          myHits: newMyHits,
          opponentHits: newOpponentHits,
          playByPlay: newPlayByPlay,
          lootDrops: newLootDrops,
          isComplete: true,
          inningComplete: true,
          myPitcherExtraFatigue: newMyPitcherExtraFatigue,
          opponentPitcherExtraFatigue: newOpponentPitcherExtraFatigue,
          // state.myPitcherInnings is already post-top-half-increment (set when top ended)
          myPitcherFatigueLevel: derivePitcherFatigueLevel(state.myPitcherInnings, newMyPitcherExtraFatigue),
          // newOpponentPitcherInnings hoisted above — opponent just finished pitching this half
          opponentPitcherFatigueLevel: derivePitcherFatigueLevel(newOpponentPitcherInnings, newOpponentPitcherExtraFatigue),
          lastBatterApproach: null,
          consecutiveBatterApproach: 0,
          lastPitchStrategy: null,
          consecutivePitchStrategy: 0,
          lastSpiritDelta,
        };
      }

      // Move to next inning
      // Batting order: continue opponent's lineup where it left off
      const oppBatters = updatedOpponentTeam.filter(isBatter);
      const oppStartIdx = state.opponentBatterIndex % (oppBatters.length || 1);
      // Save my team's batting order position for next time we bat
      const myBatterCount = updatedMyTeam.filter(isBatter).length || 1;
      const nextMyBatterIndex = (state.batterIndex + 1) % myBatterCount;
      // My pitcher rotation: check if they need to swap for the new top half
      // newOpponentPitcherInnings already declared above (hoisted for game-over branch)
      const nextMyPitcher = resolveNextPitcher(
        updatedMyTeam, updatedMyPitcher, state.myPitcherInnings
      );
      return {
        ...state,
        myTeam: updatedMyTeam,
        opponentTeam: updatedOpponentTeam,
        myPitcher: nextMyPitcher,
        opponentPitcher: updatedOpponentPitcher,
        inning: state.inning + 1,
        isTop: true,
        outs: 0,
        bases: [false, false, false],
        baseRunnerIds: [null, null, null],
        currentBatter: oppBatters[oppStartIdx],
        currentPitcher: nextMyPitcher,
        batterIndex: oppStartIdx,
        myBatterIndex: nextMyBatterIndex,
        opponentBatterIndex: state.opponentBatterIndex, // unchanged — will advance as at-bats happen
        myRuns: newMyRuns,
        opponentRuns: newOpponentRuns,
        myHits: newMyHits,
        opponentHits: newOpponentHits,
        playByPlay: newPlayByPlay,
        lootDrops: newLootDrops,
        inningComplete: true,
        opponentPitcherInnings: newOpponentPitcherInnings,
        myPitcherExtraFatigue: newMyPitcherExtraFatigue,
        opponentPitcherExtraFatigue: newOpponentPitcherExtraFatigue,
        myPitcherFatigueLevel: derivePitcherFatigueLevel(state.myPitcherInnings, newMyPitcherExtraFatigue),
        opponentPitcherFatigueLevel: derivePitcherFatigueLevel(newOpponentPitcherInnings, newOpponentPitcherExtraFatigue),
        // Reset adaptation for new half-inning
        lastBatterApproach: null,
        consecutiveBatterApproach: 0,
        lastPitchStrategy: null,
        consecutivePitchStrategy: 0,
        lastSpiritDelta,
      };
    }
  } else {
    // Continue in same half-inning, advance to next batter
    const batters = isTop
      ? state.opponentTeam.filter(isBatter)
      : state.myTeam.filter(isBatter);
    const nextBatterIndex = (state.batterIndex + 1) % batters.length;
    const nextBatter = batters[nextBatterIndex];

    // Walk-off: bottom of 9th (or extra innings), my team scores the winning run mid-inning
    const isWalkoff = !isTop && state.inning >= 9 && newMyRuns > newOpponentRuns;

    return {
      ...state,
      myTeam: updatedMyTeam,
      opponentTeam: updatedOpponentTeam,
      myPitcher: updatedMyPitcher,
      opponentPitcher: updatedOpponentPitcher,
      outs: newOuts,
      bases: newBases,
      baseRunnerIds: newRunnerIds,
      currentBatter: nextBatter,
      batterIndex: nextBatterIndex,
      // Update persistent batting order — advance the active side's index
      myBatterIndex: !isTop ? nextBatterIndex : state.myBatterIndex,
      opponentBatterIndex: isTop ? nextBatterIndex : state.opponentBatterIndex,
      myRuns: newMyRuns,
      opponentRuns: newOpponentRuns,
      myHits: newMyHits,
      opponentHits: newOpponentHits,
      playByPlay: newPlayByPlay,
      lootDrops: newLootDrops,
      isComplete: isWalkoff,
      inningComplete: false,
      myPitcherExtraFatigue: newMyPitcherExtraFatigue,
      opponentPitcherExtraFatigue: newOpponentPitcherExtraFatigue,
      myPitcherFatigueLevel: derivePitcherFatigueLevel(state.myPitcherInnings, newMyPitcherExtraFatigue),
      opponentPitcherFatigueLevel: derivePitcherFatigueLevel(state.opponentPitcherInnings, newOpponentPitcherExtraFatigue),
      // Update adaptation tracking (stays within same half-inning)
      lastBatterApproach: newLastBatterApproach,
      consecutiveBatterApproach: newConsecutiveBatter,
      lastPitchStrategy: newLastPitchStrategy,
      consecutivePitchStrategy: newConsecutiveStrategy,
      lastSpiritDelta,
    };
  }
}

/**
 * Convert interactive match state to final MatchResult
 */
export function finalizeInteractiveMatch(
  state: InteractiveMatchState,
  matchRewards?: { win: number; loss: number },
  fans: number = 1
): MatchResult {
  const isWin = state.myRuns > state.opponentRuns;
  const winBase = matchRewards?.win ?? GAME_CONSTANTS.MATCH_REWARDS.BASE_WIN;
  const lossBase = matchRewards?.loss ?? GAME_CONSTANTS.MATCH_REWARDS.BASE_LOSS;
  const cashEarned = isWin ? Math.floor(winBase * fans) : lossBase;

  return {
    myRuns: state.myRuns,
    opponentRuns: state.opponentRuns,
    isWin,
    cashEarned,
    totalInnings: state.inning,
    playByPlay: state.playByPlay,
    lootDrops: state.lootDrops,
    traceLog: state.trace?.build(
      { home: state.myRuns, away: state.opponentRuns },
      state.inning
    ),
  };
}
