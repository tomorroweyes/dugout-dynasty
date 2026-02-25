/**
 * Stepped Game Simulation Engine
 * Async generator-based simulation that yields control after each game event
 * Enables play-by-play animation, pausing, and full UI control
 */

import {
  Player,
  BatterStats,
  isBatter,
  isPitcher,
  PlayerBoxScore,
  PitcherBoxScore,
  BoxScore,
  PlayByPlayEvent,
  PlayOutcome,
} from "@/types/game";
import { GAME_CONSTANTS } from "./constants";
import { simulateAtBat } from "./atBatSimulator";
import { applyOutcome, resolveExtraBaseAttempts, BaseRunnerIds } from "./outcomeConfig";
import { calculatePlayerStatsWithEquipment } from "./itemStatsCalculator";
import { getDefaultRandomProvider } from "./randomProvider";
import { gameEvents } from "./gameEvents";
import {
  decideBatterAbility,
  decidePitcherAbility,
  processAbilityActivation,
  getPassiveAbilityContext,
  mergeAbilityContexts,
} from "./abilityAI";
import { decideBatterApproach, decidePitchStrategy } from "./approachAI";
import { generateNarrativeText } from "./narrativeEngine";
import { getTrace } from "./traceContext";

const HIT_OUTCOMES = new Set<PlayOutcome>(["single", "double", "triple", "homerun"]);

/**
 * Granularity of simulation steps
 */
export type SimulationStepType =
  | "game_start"
  | "inning_start"
  | "at_bat"
  | "inning_end"
  | "game_end";

/**
 * Current state of the game simulation
 */
export interface GameSimulationState {
  // Current game position
  inning: number;
  isTop: boolean;
  outs: number;
  bases: [boolean, boolean, boolean];
  baseRunnerIds: BaseRunnerIds; // Track which player is on each base

  // Current scores
  homeRuns: number;
  awayRuns: number;

  // Current pitchers
  homePitcher: Player;
  awayPitcher: Player;

  // Batter indices
  homeBatterIndex: number;
  awayBatterIndex: number;

  // Accumulated stats
  homeStats: GameStats;
  awayStats: GameStats;

  // Play history
  plays: PlayByPlayEvent[];

  // Game status
  isComplete: boolean;
}

/**
 * Accumulated game statistics
 */
export interface GameStats {
  batterStats: Map<
    string,
    {
      hits: number;
      abs: number;
      strikeouts: number;
      walks: number;
      runs: number;
      rbis: number;
    }
  >;
  pitcherStats: Map<
    string,
    {
      hitsAllowed: number;
      runsAllowed: number;
      strikeouts: number;
      walks: number;
      inningsPitched: number;
    }
  >;
}

/**
 * Update yielded by simulation generator
 */
export interface SimulationUpdate {
  type: SimulationStepType;
  state: GameSimulationState;
  lastPlay?: PlayByPlayEvent;
  message?: string;
}

/**
 * Options for simulation
 */
export interface SimulationOptions {
  emitEvents?: boolean; // Whether to emit game events (default: true)
  yieldGranularity?: "at_bat" | "inning" | "game"; // How often to yield (default: "at_bat")
}

/**
 * Initialize game simulation state
 */
function initializeGameState(
  homeTeam: Player[],
  awayTeam: Player[]
): GameSimulationState {
  const homePitchers = homeTeam.filter(isPitcher);
  const awayPitchers = awayTeam.filter(isPitcher);

  const homeStarter =
    homePitchers.find((p) => p.role === "Starter") || homePitchers[0];
  const awayStarter =
    awayPitchers.find((p) => p.role === "Starter") || awayPitchers[0];

  return {
    inning: 1,
    isTop: true,
    outs: 0,
    bases: [false, false, false],
    baseRunnerIds: [null, null, null],
    homeRuns: 0,
    awayRuns: 0,
    homePitcher: homeStarter,
    awayPitcher: awayStarter,
    homeBatterIndex: 0,
    awayBatterIndex: 0,
    homeStats: {
      batterStats: new Map(),
      pitcherStats: new Map(),
    },
    awayStats: {
      batterStats: new Map(),
      pitcherStats: new Map(),
    },
    plays: [],
    isComplete: false,
  };
}

/**
 * Advance runner IDs to match standard base advancement (mirrors matchEngine logic)
 */
function advanceRunnerIds(
  outcome: string,
  runnerIds: BaseRunnerIds,
  batterId: string
): BaseRunnerIds {
  const [r1, r2, r3] = runnerIds;
  switch (outcome) {
    case "walk":
      return [batterId, r1 || r2, (r1 && r2 ? r2 : null) || r3] as BaseRunnerIds;
    case "single":
      return [batterId, r1, r2] as BaseRunnerIds;
    case "double":
      return [null, batterId, r1] as BaseRunnerIds;
    case "triple":
      return [null, null, batterId] as BaseRunnerIds;
    case "homerun":
      return [null, null, null] as BaseRunnerIds;
    default:
      return [...runnerIds] as BaseRunnerIds;
  }
}

function getPlayerSpeed(player: Player): number {
  if (!isBatter(player)) return 40;
  const stats = calculatePlayerStatsWithEquipment(player) as BatterStats;
  return stats.speed;
}

function getTeamDefenseGlove(defense: Player[]): number {
  const batters = defense.filter(isBatter);
  if (batters.length === 0) return 50;
  const totalGlove = batters.reduce((sum, p) => {
    const stats = calculatePlayerStatsWithEquipment(p) as BatterStats;
    return sum + stats.glove;
  }, 0);
  return totalGlove / batters.length;
}

/**
 * Async generator that simulates a game step-by-step
 * Yields after each at-bat (or based on granularity setting)
 */
export async function* simulateGameStepped(
  homeTeam: Player[],
  awayTeam: Player[],
  options: SimulationOptions = {}
): AsyncGenerator<SimulationUpdate, GameSimulationState, void> {
  const { emitEvents = true, yieldGranularity = "at_bat" } = options;

  const state = initializeGameState(homeTeam, awayTeam);

  const homePitchers = homeTeam.filter(isPitcher);
  const awayPitchers = awayTeam.filter(isPitcher);
  const homeRelievers = homePitchers.filter((p) => p.role === "Reliever");
  const awayRelievers = awayPitchers.filter((p) => p.role === "Reliever");

  let homeRelieverIndex = 0;
  let awayRelieverIndex = 0;
  let homePitcherInnings = 0;
  let awayPitcherInnings = 0;

  if (emitEvents) {
    gameEvents.emit({ type: "game_start", homeTeam, awayTeam });
  }

  yield {
    type: "game_start",
    state: { ...state },
    message: "Game started",
  };

  const MAX_INNINGS = 18; // Safety limit

  while (state.inning <= MAX_INNINGS) {
    // Determine offensive and defensive teams
    const offense = state.isTop ? awayTeam : homeTeam;
    const defense = state.isTop ? homeTeam : awayTeam;
    const pitcher = state.isTop ? state.homePitcher : state.awayPitcher;
    const batters = offense.filter(isBatter);

    const currentBatterIndex = state.isTop ? state.awayBatterIndex : state.homeBatterIndex;
    const offenseStats = state.isTop ? state.awayStats : state.homeStats;
    const defenseStats = state.isTop ? state.homeStats : state.awayStats;

    // Initialize pitcher stats if needed
    if (!defenseStats.pitcherStats.has(pitcher.id)) {
      defenseStats.pitcherStats.set(pitcher.id, {
        hitsAllowed: 0,
        runsAllowed: 0,
        strikeouts: 0,
        walks: 0,
        inningsPitched: 0,
      });
    }

    if (emitEvents) {
      gameEvents.emit({
        type: "inning_start",
        inning: state.inning,
        isTop: state.isTop,
      });
    }

    if (yieldGranularity === "inning") {
      yield {
        type: "inning_start",
        state: { ...state },
        message: `${state.isTop ? "Top" : "Bottom"} of inning ${state.inning}`,
      };
    }

    const inningStartRuns = state.isTop ? state.awayRuns : state.homeRuns;

    // Simulate at-bats until 3 outs
    while (state.outs < 3 && currentBatterIndex < batters.length * 100) {
      const batter = batters[currentBatterIndex % batters.length];

      // Get passive and active ability contexts
      const batterPassive = getPassiveAbilityContext(batter);
      const pitcherPassive = getPassiveAbilityContext(pitcher);
      const batterActive = decideBatterAbility({ player: batter });
      const pitcherActive = decidePitcherAbility({ player: pitcher });
      const batterAbility = mergeAbilityContexts(batterPassive, batterActive);
      const pitcherAbility = mergeAbilityContexts(pitcherPassive, pitcherActive);

      // AI decides approach/strategy based on game state
      const pitcherInningsPitched = state.isTop ? homePitcherInnings : awayPitcherInnings;
      const batterApproach = decideBatterApproach({
        outs: state.outs,
        bases: state.bases,
        myScore: state.isTop ? state.awayRuns : state.homeRuns,
        opponentScore: state.isTop ? state.homeRuns : state.awayRuns,
        inning: state.inning,
        pitcherInningsPitched,
        batterPower: isBatter(batter) ? (batter.stats as BatterStats).power : undefined,
        batterContact: isBatter(batter) ? (batter.stats as BatterStats).contact : undefined,
      });
      const pitcherStrategy = decidePitchStrategy({
        outs: state.outs,
        bases: state.bases,
        myScore: state.isTop ? state.homeRuns : state.awayRuns,
        opponentScore: state.isTop ? state.awayRuns : state.homeRuns,
        inning: state.inning,
        batterPower: isBatter(batter) ? (batter.stats as BatterStats).power : undefined,
        batterContact: isBatter(batter) ? (batter.stats as BatterStats).contact : undefined,
      });

      // Trace: begin at-bat
      const trace = getTrace();
      trace?.beginAtBat({
        inning: state.inning,
        isTop: state.isTop,
        batterId: batter.id,
        batterName: batter.name,
        pitcherId: pitcher.id,
        pitcherName: pitcher.name,
        outsBefore: state.outs,
        basesBefore: [...state.bases] as [boolean, boolean, boolean],
      });
      trace?.logApproach({
        batterApproach,
        pitchStrategy: pitcherStrategy,
        approachAdaptation: 1.0,
        strategyAdaptation: 1.0,
        consecutiveBatterApproach: 0,
        consecutivePitchStrategy: 0,
      });
      trace?.logAbilities({
        batterPassive, batterActive, batterMerged: batterAbility,
        pitcherPassive, pitcherActive, pitcherMerged: pitcherAbility,
      });

      // Simulate the at-bat with abilities and approach/strategy
      const { result: outcome, clashOccurred } = simulateAtBat(
        batter, pitcher, defense, pitcherInningsPitched,
        undefined,
        batterAbility,
        pitcherAbility,
        batterApproach,
        pitcherStrategy
      );

      // Process spirit deduction for active abilities
      if (pitcherActive) {
        if (state.isTop) {
          state.homePitcher = processAbilityActivation(state.homePitcher, pitcherActive);
        } else {
          state.awayPitcher = processAbilityActivation(state.awayPitcher, pitcherActive);
        }
      }

      // Initialize batter stats if needed
      if (!offenseStats.batterStats.has(batter.id)) {
        offenseStats.batterStats.set(batter.id, {
          hits: 0,
          abs: 0,
          strikeouts: 0,
          walks: 0,
          runs: 0,
          rbis: 0,
        });
      }

      const batterStats = offenseStats.batterStats.get(batter.id)!;
      const pitcherStatsMap = defenseStats.pitcherStats.get(pitcher.id)!;

      // Apply outcome
      const result = applyOutcome(
        outcome,
        state.bases,
        batterStats,
        {
          hitsAllowed: pitcherStatsMap.hitsAllowed,
          runsAllowed: pitcherStatsMap.runsAllowed,
          strikeouts: pitcherStatsMap.strikeouts,
          walks: pitcherStatsMap.walks,
        },
        state.outs
      );

      // Update state
      offenseStats.batterStats.set(batter.id, result.batterStats);
      defenseStats.pitcherStats.set(pitcher.id, {
        ...pitcherStatsMap,
        hitsAllowed: result.pitcherStats.hitsAllowed,
        runsAllowed: result.pitcherStats.runsAllowed,
        strikeouts: result.pitcherStats.strikeouts,
        walks: result.pitcherStats.walks,
      });

      // Advance runner IDs and apply speed-based baserunning
      const basesBeforeHit: [boolean, boolean, boolean] = [...state.bases];
      state.baseRunnerIds = advanceRunnerIds(outcome, state.baseRunnerIds, batter.id);
      state.bases = result.bases;
      state.outs = result.outs;

      if (state.isTop) {
        state.awayRuns += result.runsScored;
      } else {
        state.homeRuns += result.runsScored;
      }

      // Speed-based extra base attempts
      let speedNarrative: string | undefined;
      if ((outcome === "single" || outcome === "double") && state.outs < 3) {
        const speedLookup = (id: string) => {
          const player = offense.find((p) => p.id === id);
          return player ? getPlayerSpeed(player) : 40;
        };
        const defGlove = getTeamDefenseGlove(defense);
        const rng = getDefaultRandomProvider();

        const extraBaseResult = resolveExtraBaseAttempts(
          outcome,
          basesBeforeHit,
          state.bases,
          state.baseRunnerIds,
          speedLookup,
          defGlove,
          state.outs,
          rng
        );

        state.bases = extraBaseResult.bases;
        state.baseRunnerIds = extraBaseResult.baseRunnerIds;
        speedNarrative = extraBaseResult.narrative;

        if (extraBaseResult.thrownOut) {
          state.outs++;
        }

        if (extraBaseResult.extraRuns > 0) {
          if (state.isTop) {
            state.awayRuns += extraBaseResult.extraRuns;
          } else {
            state.homeRuns += extraBaseResult.extraRuns;
          }
          // Update batter RBIs
          const currentStats = offenseStats.batterStats.get(batter.id)!;
          currentStats.rbis += extraBaseResult.extraRuns;
          offenseStats.batterStats.set(batter.id, currentStats);
        }
      }

      // Generate narrative text with ability and approach/strategy context
      let narrativeText = generateNarrativeText(
        outcome,
        batter,
        pitcher,
        state.outs,
        undefined,
        batterAbility,
        pitcherAbility,
        clashOccurred,
        batterApproach,
        pitcherStrategy,
        result.runsScored
      );
      if (speedNarrative) {
        narrativeText = narrativeText
          ? `${narrativeText} — ${speedNarrative}`
          : speedNarrative;
      }

      // Trace: end at-bat
      trace?.logSpirit({ batterDelta: 0, pitcherDelta: 0, teamDelta: 0 });
      trace?.endAtBat(outcome, result.runsScored, state.outs, [...state.bases] as [boolean, boolean, boolean]);

      // Record play
      const play: PlayByPlayEvent = {
        inning: state.inning,
        isTop: state.isTop,
        batter: batter.name,
        pitcher: pitcher.name,
        outcome,
        rbi: result.runsScored > 0 ? result.runsScored : undefined,
        outs: state.outs,
        narrativeText,
        batterAbilityUsed: !!batterActive,
        pitcherAbilityUsed: !!pitcherActive,
      };
      state.plays.push(play);

      // Emit events
      if (emitEvents) {
        gameEvents.emit({
          type: "at_bat_result",
          batter,
          pitcher,
          outcome,
          rbi: result.runsScored,
          inning: state.inning,
          isTop: state.isTop,
        });

        // Emit specific outcome events
        if (outcome === "homerun") {
          gameEvents.emit({
            type: "homerun",
            batter,
            pitcher,
            rbi: result.runsScored,
            inning: state.inning,
          });
        } else if (outcome === "strikeout") {
          gameEvents.emit({
            type: "strikeout",
            batter,
            pitcher,
            inning: state.inning,
          });
        }
      }

      // Increment batter
      if (state.isTop) {
        state.awayBatterIndex++;
      } else {
        state.homeBatterIndex++;
      }

      // Yield after each at-bat
      if (yieldGranularity === "at_bat") {
        yield {
          type: "at_bat",
          state: { ...state },
          lastPlay: play,
        };
      }

      // Check for walk-off
      if (!state.isTop && state.inning >= 9 && state.homeRuns > state.awayRuns) {
        state.outs = 3; // End inning
        break;
      }
    }

    // Update pitcher innings
    if (state.isTop) {
      homePitcherInnings++;
      const pitcherStat = state.homeStats.pitcherStats.get(state.homePitcher.id)!;
      pitcherStat.inningsPitched++;
    } else {
      awayPitcherInnings++;
      const pitcherStat = state.awayStats.pitcherStats.get(state.awayPitcher.id)!;
      pitcherStat.inningsPitched++;
    }

    const inningRuns = (state.isTop ? state.awayRuns : state.homeRuns) - inningStartRuns;
    const inningHits = state.plays.filter(
      (p) => p.inning === state.inning && p.isTop === state.isTop && HIT_OUTCOMES.has(p.outcome)
    ).length;

    if (emitEvents) {
      gameEvents.emit({
        type: "inning_end",
        inning: state.inning,
        isTop: state.isTop,
        runs: inningRuns,
        hits: inningHits,
      });
    }

    if (yieldGranularity === "inning") {
      yield {
        type: "inning_end",
        state: { ...state },
        message: `End of ${state.isTop ? "top" : "bottom"} ${state.inning}`,
      };
    }

    // Reset for next half-inning
    state.outs = 0;
    state.bases = [false, false, false];
    state.baseRunnerIds = [null, null, null];

    // Switch sides or advance inning
    if (state.isTop) {
      state.isTop = false;
    } else {
      // Check for pitcher changes
      if (
        state.inning === GAME_CONSTANTS.PITCHER_ROTATION.FIRST_RELIEVER_INNING &&
        homeRelieverIndex < homeRelievers.length
      ) {
        state.homePitcher = homeRelievers[homeRelieverIndex++];
        homePitcherInnings = 0;
      } else if (
        state.inning === GAME_CONSTANTS.PITCHER_ROTATION.SECOND_RELIEVER_INNING &&
        homeRelieverIndex < homeRelievers.length
      ) {
        state.homePitcher = homeRelievers[homeRelieverIndex++];
        homePitcherInnings = 0;
      }

      if (
        state.inning === GAME_CONSTANTS.PITCHER_ROTATION.FIRST_RELIEVER_INNING &&
        awayRelieverIndex < awayRelievers.length
      ) {
        state.awayPitcher = awayRelievers[awayRelieverIndex++];
        awayPitcherInnings = 0;
      } else if (
        state.inning === GAME_CONSTANTS.PITCHER_ROTATION.SECOND_RELIEVER_INNING &&
        awayRelieverIndex < awayRelievers.length
      ) {
        state.awayPitcher = awayRelievers[awayRelieverIndex++];
        awayPitcherInnings = 0;
      }

      state.isTop = true;
      state.inning++;
    }

    // Check if game is over
    if (state.inning > 9 && !state.isTop && state.homeRuns !== state.awayRuns) {
      break;
    }
  }

  state.isComplete = true;

  if (emitEvents) {
    gameEvents.emit({
      type: "game_end",
      homeRuns: state.homeRuns,
      awayRuns: state.awayRuns,
      isWin: state.homeRuns > state.awayRuns,
    });
  }

  yield {
    type: "game_end",
    state: { ...state },
    message: `Game over: ${state.homeRuns} - ${state.awayRuns}`,
  };

  return state;
}

/**
 * Build box score from final game state
 */
export function buildBoxScore(
  homeTeam: Player[],
  awayTeam: Player[],
  state: GameSimulationState
): BoxScore {
  const homeBatters: PlayerBoxScore[] = homeTeam.filter(isBatter).map((p) => {
    const stats = state.homeStats.batterStats.get(p.id) || {
      hits: 0,
      abs: 0,
      strikeouts: 0,
      walks: 0,
      runs: 0,
      rbis: 0,
    };
    return {
      playerId: p.id,
      name: p.name,
      atBats: stats.abs,
      hits: stats.hits,
      runs: stats.runs,
      rbis: stats.rbis,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
    };
  });

  const awayBatters: PlayerBoxScore[] = awayTeam.filter(isBatter).map((p) => {
    const stats = state.awayStats.batterStats.get(p.id) || {
      hits: 0,
      abs: 0,
      strikeouts: 0,
      walks: 0,
      runs: 0,
      rbis: 0,
    };
    return {
      playerId: p.id,
      name: p.name,
      atBats: stats.abs,
      hits: stats.hits,
      runs: stats.runs,
      rbis: stats.rbis,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
    };
  });

  const homePitchers: PitcherBoxScore[] = Array.from(
    state.homeStats.pitcherStats.entries()
  ).map(([pitcherId, stats]) => {
    const pitcher = homeTeam.find((p) => p.id === pitcherId)!;
    return {
      playerId: pitcherId,
      name: pitcher.name,
      inningsPitched: stats.inningsPitched,
      hitsAllowed: stats.hitsAllowed,
      runsAllowed: stats.runsAllowed,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
    };
  });

  const awayPitchers: PitcherBoxScore[] = Array.from(
    state.awayStats.pitcherStats.entries()
  ).map(([pitcherId, stats]) => {
    const pitcher = awayTeam.find((p) => p.id === pitcherId)!;
    return {
      playerId: pitcherId,
      name: pitcher.name,
      inningsPitched: stats.inningsPitched,
      hitsAllowed: stats.hitsAllowed,
      runsAllowed: stats.runsAllowed,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
    };
  });

  return {
    myBatters: homeBatters,
    myPitchers: homePitchers,
    opponentBatters: awayBatters,
    opponentPitchers: awayPitchers,
    myHits: Array.from(state.homeStats.batterStats.values()).reduce(
      (sum, s) => sum + s.hits,
      0
    ),
    opponentHits: Array.from(state.awayStats.batterStats.values()).reduce(
      (sum, s) => sum + s.hits,
      0
    ),
  };
}

/**
 * Run entire simulation to completion (convenience function)
 */
export async function runSimulationToEnd(
  homeTeam: Player[],
  awayTeam: Player[],
  options?: SimulationOptions
): Promise<GameSimulationState> {
  let finalState: GameSimulationState | null = null;

  for await (const update of simulateGameStepped(homeTeam, awayTeam, options)) {
    finalState = update.state;
  }

  return finalState!;
}
