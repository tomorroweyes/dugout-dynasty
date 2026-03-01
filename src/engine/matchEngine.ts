import {
  Player,
  Team,
  MatchResult,
  isBatter,
  isPitcher,
  BatterStats,
  PitcherStats,
  PlayerBoxScore,
  PitcherBoxScore,
  BoxScore,
  PlayByPlayEvent,
} from "@/types/game";
import { generateStarterTeam } from "./playerGenerator";
import { getDefaultRandomProvider } from "./randomProvider";
import { GAME_CONSTANTS } from "./constants";
import { simulateAtBat } from "./atBatSimulator";
import { applyOutcome, resolveExtraBaseAttempts, BaseRunnerIds } from "./outcomeConfig";
import { calculatePlayerStatsWithEquipment } from "./itemStatsCalculator";
import { gameEvents } from "./gameEvents";
import { RandomProvider } from "./randomProvider";
import { generateNarrativeText, type BatterHistory, type NarrativeGameState } from "./narrativeEngine";
import {
  decideBatterAbility,
  decidePitcherAbility,
  processAbilityActivation,
  getPassiveAbilityContext,
  mergeAbilityContexts,
} from "./abilityAI";
import { decideBatterApproach, decidePitchStrategy } from "./approachAI";
import { BATTER_APPROACHES, PITCH_STRATEGIES } from "./approachConfig";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import { getTrace, withTrace, GameTraceCollector } from "./traceContext";
import { SeededRandomProvider } from "./randomProvider";
import { calculateSynergies, type ActiveSynergies } from "./synergySystem";

interface InningStats {
  runs: number;
  batterStats: Map<
    string,
    {
      hits: number;
      abs: number;
      strikeouts: number;
      walks: number;
      runs: number;
      rbis: number;
      // Detailed hit tracking for XP
      doubles: number;
      triples: number;
      homeRuns: number;
    }
  >;
  pitcherStats: {
    hitsAllowed: number;
    runsAllowed: number;
    strikeouts: number;
    walks: number;
    // Detailed tracking for XP
    homeRunsAllowed: number;
  };
  nextBatterIndex: number; // Track where to continue batting order
  plays: PlayByPlayEvent[];
  /** Accumulated extra pitcher fatigue from Patient at-bats and Paint self-cost this inning */
  extraPitcherFatigue: number;
}

/**
 * Advance runner IDs to match standard base advancement.
 * Mirrors the logic in BaseAdvancementRules for tracking WHO is on each base.
 */
function advanceRunnerIds(
  outcome: string,
  runnerIds: BaseRunnerIds,
  batterId: string
): { newRunnerIds: BaseRunnerIds; scoredIds: string[] } {
  const [r1, r2, r3] = runnerIds;
  const scoredIds: string[] = [];

  switch (outcome) {
    case "walk": {
      // Force advance only
      if (r1 && r2 && r3) scoredIds.push(r3);
      return {
        newRunnerIds: [
          batterId,
          r1 || r2,
          (r1 && r2 ? r2 : null) || r3,
        ] as BaseRunnerIds,
        scoredIds,
      };
    }
    case "single": {
      if (r3) scoredIds.push(r3);
      return {
        newRunnerIds: [batterId, r1, r2] as BaseRunnerIds,
        scoredIds,
      };
    }
    case "double": {
      if (r3) scoredIds.push(r3);
      if (r2) scoredIds.push(r2);
      return {
        newRunnerIds: [null, batterId, r1] as BaseRunnerIds,
        scoredIds,
      };
    }
    case "triple": {
      if (r1) scoredIds.push(r1);
      if (r2) scoredIds.push(r2);
      if (r3) scoredIds.push(r3);
      return {
        newRunnerIds: [null, null, batterId] as BaseRunnerIds,
        scoredIds,
      };
    }
    case "homerun": {
      if (r1) scoredIds.push(r1);
      if (r2) scoredIds.push(r2);
      if (r3) scoredIds.push(r3);
      scoredIds.push(batterId);
      return {
        newRunnerIds: [null, null, null] as BaseRunnerIds,
        scoredIds,
      };
    }
    default:
      // Outs — no movement
      return { newRunnerIds: [...runnerIds] as BaseRunnerIds, scoredIds };
  }
}

/**
 * Get effective speed for a player (with equipment/techniques applied)
 */
function getPlayerSpeed(player: Player): number {
  if (!isBatter(player)) return 40; // Pitchers have low base speed
  const stats = calculatePlayerStatsWithEquipment(player) as BatterStats;
  return stats.speed;
}

/**
 * Get average defensive glove rating for a team
 */
function getTeamDefenseGlove(defense: Player[]): number {
  const batters = defense.filter(isBatter);
  if (batters.length === 0) return 50;
  const totalGlove = batters.reduce((sum, p) => {
    const stats = calculatePlayerStatsWithEquipment(p) as BatterStats;
    return sum + stats.glove;
  }, 0);
  return totalGlove / batters.length;
}

// Simulate an inning with stat tracking
function simulateInningWithStats(
  offense: Player[],
  defense: Player[],
  pitcher: Player,
  pitcherInningsPitched: number,
  startingBatterIndex: number = 0,
  inning: number = 0,
  isTop: boolean = true,
  rng?: RandomProvider,
  batterSpiritMap?: Map<string, Player>,
  offenseScore: number = 0,
  defenseScore: number = 0,
  incomingExtraPitcherFatigue: number = 0,
  offenseSynergies?: ActiveSynergies,
  defenseSynergies?: ActiveSynergies,
  crossInningBatterHistory?: Map<string, BatterHistory>
): InningStats {
  let runs = 0;
  let outs = 0;
  let bases: [boolean, boolean, boolean] = [false, false, false]; // 1st, 2nd, 3rd
  let baseRunnerIds: BaseRunnerIds = [null, null, null]; // Track WHO is on each base
  let batterIndex = startingBatterIndex;
  const defenseGlove = getTeamDefenseGlove(defense); // Cache for speed checks

  const batters = offense.filter(isBatter);
  const batterStats = new Map<
    string,
    {
      hits: number;
      abs: number;
      strikeouts: number;
      walks: number;
      runs: number;
      rbis: number;
      doubles: number;
      triples: number;
      homeRuns: number;
    }
  >();
  const pitcherStats = {
    hitsAllowed: 0,
    runsAllowed: 0,
    strikeouts: 0,
    walks: 0,
    homeRunsAllowed: 0,
  };
  const plays: PlayByPlayEvent[] = [];

  // Safety check: if no batters, return empty stats
  if (batters.length === 0)
    return {
      runs: 0,
      batterStats,
      pitcherStats,
      nextBatterIndex: 0,
      plays: [],
      extraPitcherFatigue: incomingExtraPitcherFatigue,
    };

  // Track mutable pitcher for spirit updates
  let currentPitcher = { ...pitcher };
  // Track previous active ability for Repertoire passive penalty
  let previousPitcherAbilityId: string | undefined = undefined;
  const hasRepertoire =
    currentPitcher.abilities?.some((a) => a.abilityId === "repertoire") ?? false;

  // Adaptation tracking (resets per half-inning)
  let lastBatterApproach: BatterApproach | null = null;
  let consecutiveBatterApproach = 0;
  let lastPitchStrategy: PitchStrategy | null = null;
  let consecutivePitchStrategy = 0;

  // Extra fatigue accumulated from Patient at-bats and Paint self-cost
  let extraPitcherFatigue = incomingExtraPitcherFatigue;

  while (outs < 3 && batterIndex < startingBatterIndex + batters.length * 3) {
    const baseBatter = batters[batterIndex % batters.length];
    // Use spirit-tracked version if available (preserves spirit deductions across at-bats)
    const batter = batterSpiritMap?.get(baseBatter.id) ?? baseBatter;

    // Get passive ability contexts (always active, no spirit cost)
    const batterPassive = getPassiveAbilityContext(batter);
    const pitcherPassive = getPassiveAbilityContext(currentPitcher);

    // AI decides whether to activate an active ability
    const batterActive = decideBatterAbility({ player: batter, random: rng });
    const pitcherActive = decidePitcherAbility({
      player: currentPitcher,
      random: rng,
    });

    // Merge passive + active contexts
    const batterAbility = mergeAbilityContexts(batterPassive, batterActive);
    let pitcherAbility = mergeAbilityContexts(pitcherPassive, pitcherActive);

    // Apply Repertoire passive penalty: -10 Break if same active ability used consecutively
    if (
      hasRepertoire &&
      pitcherActive &&
      pitcherActive.abilityId === previousPitcherAbilityId &&
      pitcherAbility
    ) {
      pitcherAbility = {
        ...pitcherAbility,
        effects: [
          ...pitcherAbility.effects,
          { type: "stat_modifier" as const, break: -10, duration: "at_bat" as const },
        ],
      };
    }

    // AI decides approach/strategy based on game state (with adaptation awareness)
    const batterApproach = decideBatterApproach({
      outs,
      bases,
      myScore: offenseScore + runs,
      opponentScore: defenseScore,
      inning,
      pitcherInningsPitched,
      pitcherFatigueAccum: extraPitcherFatigue,
      batterPower: isBatter(batter) ? (batter.stats as BatterStats).power : undefined,
      batterContact: isBatter(batter) ? (batter.stats as BatterStats).contact : undefined,
      lastApproach: lastBatterApproach ?? undefined,
      consecutiveCount: consecutiveBatterApproach,
    }, rng);

    const pitcherStrategy = decidePitchStrategy({
      outs,
      bases,
      myScore: defenseScore,
      opponentScore: offenseScore + runs,
      inning,
      pitcherFatigueAccum: extraPitcherFatigue,
      batterPower: isBatter(batter) ? (batter.stats as BatterStats).power : undefined,
      batterContact: isBatter(batter) ? (batter.stats as BatterStats).contact : undefined,
      lastStrategy: lastPitchStrategy ?? undefined,
      consecutiveCount: consecutivePitchStrategy,
    }, rng);

    // Update adaptation tracking
    if (batterApproach === lastBatterApproach) {
      consecutiveBatterApproach++;
    } else {
      consecutiveBatterApproach = 1;
    }
    lastBatterApproach = batterApproach;

    if (pitcherStrategy === lastPitchStrategy) {
      consecutivePitchStrategy++;
    } else {
      consecutivePitchStrategy = 1;
    }
    lastPitchStrategy = pitcherStrategy;

    // Calculate adaptation multipliers
    const adaptationScale = GAME_CONSTANTS.ADAPTATION.PENALTY_SCALE;
    const approachAdaptation = adaptationScale[Math.min(Math.max(consecutiveBatterApproach - 1, 0), adaptationScale.length - 1)];
    const strategyAdaptation = adaptationScale[Math.min(Math.max(consecutivePitchStrategy - 1, 0), adaptationScale.length - 1)];

    // Trace: begin at-bat
    const trace = getTrace();
    trace?.beginAtBat({
      inning: inning,
      isTop,
      batterId: batter.id,
      batterName: batter.name,
      pitcherId: currentPitcher.id,
      pitcherName: currentPitcher.name,
      outsBefore: outs,
      basesBefore: [...bases] as [boolean, boolean, boolean],
    });
    trace?.logApproach({
      batterApproach,
      pitchStrategy: pitcherStrategy,
      approachAdaptation,
      strategyAdaptation,
      consecutiveBatterApproach,
      consecutivePitchStrategy,
    });
    trace?.logAbilities({
      batterPassive: batterPassive,
      batterActive: batterActive,
      batterMerged: batterAbility,
      pitcherPassive: pitcherPassive,
      pitcherActive: pitcherActive,
      pitcherMerged: pitcherAbility,
    });

    // Simulate at-bat with abilities, approach/strategy, fatigue, adaptation, and synergies
    const { result, clashOccurred } = simulateAtBat(
      batter,
      currentPitcher,
      defense,
      pitcherInningsPitched,
      rng,
      batterAbility,
      pitcherAbility,
      batterApproach,
      pitcherStrategy,
      extraPitcherFatigue,
      approachAdaptation,
      strategyAdaptation,
      offenseSynergies,
      defenseSynergies
    );

    // Track previous ability for Repertoire penalty
    if (pitcherActive) {
      previousPitcherAbilityId = pitcherActive.abilityId;
    }

    // Process ability activations (deduct spirit for active abilities only)
    if (batterActive) {
      const updatedBatter = processAbilityActivation(batter, batterActive);
      if (batterSpiritMap) {
        batterSpiritMap.set(baseBatter.id, updatedBatter);
      }
    }

    if (pitcherActive) {
      currentPitcher = processAbilityActivation(currentPitcher, pitcherActive);
    }

    // ── Extra Fatigue from Patient / Paint ──
    if (batterApproach === "patient") {
      extraPitcherFatigue += BATTER_APPROACHES.patient.fatigueEffect ?? 0;
    }
    if (pitcherStrategy === "paint") {
      extraPitcherFatigue += PITCH_STRATEGIES.paint.fatigueCost ?? 0;
    }

    // Initialize batter stats if not exists
    if (!batterStats.has(batter.id)) {
      batterStats.set(batter.id, {
        hits: 0,
        abs: 0,
        strikeouts: 0,
        walks: 0,
        runs: 0,
        rbis: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
      });
    }
    const stats = batterStats.get(batter.id)!;

    // Apply outcome using the configuration system
    // Note: applyOutcome uses a simplified stats type, we extend it with detailed tracking
    const simplifiedStats = {
      hits: stats.hits,
      abs: stats.abs,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
      runs: stats.runs,
      rbis: stats.rbis,
    };
    const simplifiedPitcherStats = {
      hitsAllowed: pitcherStats.hitsAllowed,
      runsAllowed: pitcherStats.runsAllowed,
      strikeouts: pitcherStats.strikeouts,
      walks: pitcherStats.walks,
    };
    const outcomeResult = applyOutcome(
      result,
      bases,
      simplifiedStats,
      simplifiedPitcherStats,
      outs
    );

    // Update all state from the outcome
    const updatedBatterStats = {
      ...outcomeResult.batterStats,
      doubles: stats.doubles + (result === "double" ? 1 : 0),
      triples: stats.triples + (result === "triple" ? 1 : 0),
      homeRuns: stats.homeRuns + (result === "homerun" ? 1 : 0),
    };
    batterStats.set(batter.id, updatedBatterStats);

    // Update pitcher stats including homeRunsAllowed
    pitcherStats.hitsAllowed = outcomeResult.pitcherStats.hitsAllowed;
    pitcherStats.runsAllowed = outcomeResult.pitcherStats.runsAllowed;
    pitcherStats.strikeouts = outcomeResult.pitcherStats.strikeouts;
    pitcherStats.walks = outcomeResult.pitcherStats.walks;
    if (result === "homerun") {
      pitcherStats.homeRunsAllowed++;
    }

    // Advance runner IDs to match standard base advancement
    const basesBeforeHit: [boolean, boolean, boolean] = [...bases];
    const { newRunnerIds } = advanceRunnerIds(result, baseRunnerIds, batter.id);
    baseRunnerIds = newRunnerIds;

    bases = outcomeResult.bases;
    outs = outcomeResult.outs;
    runs += outcomeResult.runsScored;

    // Speed-based extra base attempts (only on singles/doubles with runners)
    let speedNarrative: string | undefined;
    if ((result === "single" || result === "double") && outs < 3) {
      const speedLookup = (id: string) => {
        const player = offense.find((p) => p.id === id);
        return player ? getPlayerSpeed(player) : 40;
      };

      const extraBaseResult = resolveExtraBaseAttempts(
        result,
        basesBeforeHit,
        bases,
        baseRunnerIds,
        speedLookup,
        defenseGlove,
        outs,
        rng || getDefaultRandomProvider()
      );

      bases = extraBaseResult.bases;
      baseRunnerIds = extraBaseResult.baseRunnerIds;
      runs += extraBaseResult.extraRuns;
      speedNarrative = extraBaseResult.narrative;

      // If thrown out, increment outs and update pitcher stats
      if (extraBaseResult.thrownOut) {
        outs++;
      }

      // Update batter RBIs for extra runs scored via speed
      if (extraBaseResult.extraRuns > 0) {
        const currentStats = batterStats.get(batter.id)!;
        currentStats.rbis += extraBaseResult.extraRuns;
        batterStats.set(batter.id, currentStats);
        pitcherStats.runsAllowed += extraBaseResult.extraRuns;
      }
    }

    // ── Spirit Momentum ──
    const totalRunsOnPlay = outcomeResult.runsScored + (speedNarrative ? (runs - outcomeResult.runsScored) : 0);
    const M = GAME_CONSTANTS.SPIRIT_MOMENTUM;
    let batterSpiritDelta = 0;
    let pitcherSpiritDelta = 0;

    switch (result) {
      case "single": batterSpiritDelta = M.SINGLE; pitcherSpiritDelta = M.PITCH_HIT_ALLOWED; break;
      case "double": batterSpiritDelta = M.DOUBLE; pitcherSpiritDelta = M.PITCH_HIT_ALLOWED; break;
      case "triple": batterSpiritDelta = M.TRIPLE; pitcherSpiritDelta = M.PITCH_HIT_ALLOWED; break;
      case "homerun": batterSpiritDelta = M.HOMERUN; pitcherSpiritDelta = M.PITCH_HR_ALLOWED; break;
      case "walk": batterSpiritDelta = M.WALK; pitcherSpiritDelta = M.PITCH_WALK_ALLOWED; break;
      case "strikeout": batterSpiritDelta = M.STRIKEOUT; pitcherSpiritDelta = M.PITCH_STRIKEOUT; break;
      case "groundout": pitcherSpiritDelta = M.PITCH_GROUNDOUT; break;
      case "flyout": pitcherSpiritDelta = M.PITCH_FLYOUT; break;
      case "lineout": pitcherSpiritDelta = M.PITCH_LINEOUT; break;
      case "popout": pitcherSpiritDelta = M.PITCH_POPOUT; break;
    }
    if (totalRunsOnPlay > 0) {
      batterSpiritDelta += M.RBI_BONUS * totalRunsOnPlay;
      pitcherSpiritDelta += M.PITCH_RUN_ALLOWED * totalRunsOnPlay;
    }

    // Apply batter spirit delta
    if (batterSpiritDelta !== 0 && batterSpiritMap) {
      const current = batterSpiritMap.get(baseBatter.id) ?? baseBatter;
      if (current.spirit) {
        const updated = {
          ...current,
          spirit: {
            ...current.spirit,
            current: Math.max(0, Math.min(current.spirit.max, current.spirit.current + batterSpiritDelta)),
          },
        };
        batterSpiritMap.set(baseBatter.id, updated);
      }
    }

    // Apply pitcher spirit delta
    if (pitcherSpiritDelta !== 0 && currentPitcher.spirit) {
      currentPitcher = {
        ...currentPitcher,
        spirit: {
          ...currentPitcher.spirit,
          current: Math.max(0, Math.min(currentPitcher.spirit.max, currentPitcher.spirit.current + pitcherSpiritDelta)),
        },
      };
    }

    // Team-wide spirit bonus when runs score
    if (totalRunsOnPlay > 0 && batterSpiritMap) {
      const teamDelta = M.TEAM_RUN_SCORED * totalRunsOnPlay;
      for (const [id, player] of batterSpiritMap.entries()) {
        if (player.spirit) {
          batterSpiritMap.set(id, {
            ...player,
            spirit: {
              ...player.spirit,
              current: Math.max(0, Math.min(player.spirit.max, player.spirit.current + teamDelta)),
            },
          });
        }
      }
    }

    // Trace: spirit + end at-bat
    trace?.logSpirit({
      batterDelta: batterSpiritDelta,
      pitcherDelta: pitcherSpiritDelta,
      teamDelta: totalRunsOnPlay > 0 ? GAME_CONSTANTS.SPIRIT_MOMENTUM.TEAM_RUN_SCORED * totalRunsOnPlay : 0,
    });
    trace?.endAtBat(result, totalRunsOnPlay, outs, [...bases] as [boolean, boolean, boolean]);

    // Record the play with narrative text
    const currentBatterHistory = crossInningBatterHistory?.get(batter.id);
    const narrativeGameState: NarrativeGameState = {
      inning,
      scoreDiff: offenseScore + runs - defenseScore, // offense POV at time of AB
      bases: [...bases] as [boolean, boolean, boolean],
    };
    let narrativeText = generateNarrativeText(
      result,
      batter,
      currentPitcher,
      outs,
      rng,
      batterAbility || undefined,
      pitcherAbility || undefined,
      clashOccurred,
      batterApproach,
      pitcherStrategy,
      outcomeResult.runsScored,
      undefined,
      currentBatterHistory,
      narrativeGameState
    );

    // Update cross-inning batter history after each AB
    if (crossInningBatterHistory) {
      const prev = crossInningBatterHistory.get(batter.id) ?? { abs: 0, hits: 0, strikeouts: 0, walks: 0 };
      const isHit = ["single", "double", "triple", "homerun"].includes(result);

      // Determine if this AB should arm the redemption flag for the batter's NEXT AB:
      // failed (out/strikeout) with RISP (2nd or 3rd occupied) in a high-leverage spot
      // (inning 7+, close game within 2 runs). Flag is always cleared entering any AB,
      // then re-armed here if conditions are met. basesBeforeHit = pre-AB base state.
      const isOutOrStrikeout = ["groundout", "flyout", "lineout", "popout", "strikeout"].includes(result);
      const hadRISP = basesBeforeHit[1] || basesBeforeHit[2];
      const isHighLeverageInning = inning >= 7;
      const isCloseAtAB = Math.abs(narrativeGameState.scoreDiff) <= 2;
      const armRedemption = isOutOrStrikeout && hadRISP && isHighLeverageInning && isCloseAtAB;

      crossInningBatterHistory.set(batter.id, {
        abs: prev.abs + 1,
        hits: prev.hits + (isHit ? 1 : 0),
        strikeouts: prev.strikeouts + (result === "strikeout" ? 1 : 0),
        walks: prev.walks + (result === "walk" ? 1 : 0),
        // Clear existing flag (consumed this AB); re-arm if this AB qualifies
        redemptionOpportunity: armRedemption,
      });
    }
    // Append speed narrative if a runner tried for an extra base
    if (speedNarrative) {
      narrativeText = narrativeText
        ? `${narrativeText} — ${speedNarrative}`
        : speedNarrative;
    }
    plays.push({
      inning,
      isTop,
      batter: batter.name,
      pitcher: currentPitcher.name,
      outcome: result,
      rbi: outcomeResult.runsScored > 0 ? outcomeResult.runsScored : undefined,
      outs,
      narrativeText,
      batterApproach: batterApproach,
      pitchStrategy: pitcherStrategy,
      batterAbilityUsed: !!batterActive,
      pitcherAbilityUsed: !!pitcherActive,
    });

    batterIndex++;
  }

  pitcherStats.runsAllowed = runs;
  return {
    runs,
    batterStats,
    pitcherStats,
    nextBatterIndex: batterIndex,
    plays,
    extraPitcherFatigue,
  };
}

// Simulate a full 9-inning game with box score
function simulateGame(
  myTeam: Player[],
  opponentTeam: Player[],
  emitEvents = false,
  rng?: RandomProvider
): {
  myRuns: number;
  opponentRuns: number;
  boxScore: BoxScore;
  playByPlay: PlayByPlayEvent[];
  totalInnings: number;
} {
  let myRuns = 0;
  let opponentRuns = 0;
  const allPlays: PlayByPlayEvent[] = [];

  if (emitEvents) {
    gameEvents.emit({
      type: "game_start",
      homeTeam: myTeam,
      awayTeam: opponentTeam,
    });
  }

  const myPitchers = myTeam.filter(isPitcher);
  const opponentPitchers = opponentTeam.filter(isPitcher);

  // Safety checks: need at least one pitcher on each team
  if (myPitchers.length === 0 || opponentPitchers.length === 0) {
    console.error("Cannot simulate game: missing pitchers");
    const emptyBoxScore: BoxScore = {
      myBatters: [],
      myPitchers: [],
      opponentBatters: [],
      opponentPitchers: [],
      myHits: 0,
      opponentHits: 0,
    };
    return {
      myRuns: 0,
      opponentRuns: 0,
      boxScore: emptyBoxScore,
      playByPlay: [],
      totalInnings: 0,
    };
  }

  // Simple pitcher rotation - use first pitcher
  const myStarter =
    myPitchers.find((p) => p.role === "Starter") || myPitchers[0];
  const myRelievers = myPitchers.filter((p) => p.role === "Reliever");
  const opponentStarter =
    opponentPitchers.find((p) => p.role === "Starter") || opponentPitchers[0];
  const opponentRelievers = opponentPitchers.filter(
    (p) => p.role === "Reliever"
  );

  // Track which pitcher is currently pitching and their innings pitched
  let myCurrentPitcher = myStarter;
  let myCurrentPitcherInnings = 0;
  let myRelieverIndex = 0;

  let opponentCurrentPitcher = opponentStarter;
  let opponentCurrentPitcherInnings = 0;
  let opponentRelieverIndex = 0;

  // Aggregate stats (track all pitchers used)
  const myPitchersUsed = new Map<
    string,
    {
      hitsAllowed: number;
      runsAllowed: number;
      strikeouts: number;
      walks: number;
      inningsPitched: number;
      homeRunsAllowed: number;
    }
  >();
  const opponentPitchersUsed = new Map<
    string,
    {
      hitsAllowed: number;
      runsAllowed: number;
      strikeouts: number;
      walks: number;
      inningsPitched: number;
      homeRunsAllowed: number;
    }
  >();

  // Aggregate stats
  const myBatterStats = new Map<
    string,
    {
      hits: number;
      abs: number;
      strikeouts: number;
      walks: number;
      runs: number;
      rbis: number;
      doubles: number;
      triples: number;
      homeRuns: number;
    }
  >();
  const opponentBatterStats = new Map<
    string,
    {
      hits: number;
      abs: number;
      strikeouts: number;
      walks: number;
      runs: number;
      rbis: number;
      doubles: number;
      triples: number;
      homeRuns: number;
    }
  >();

  // Track batting order position across innings
  let myBatterIndex = 0;
  let opponentBatterIndex = 0;

  // Track batter spirit across innings (deducted when abilities activate)
  const myBatterSpirit = new Map<string, Player>();
  const opponentBatterSpirit = new Map<string, Player>();

  // Track accumulated extra fatigue from Patient at-bats and Paint self-cost
  let myPitcherExtraFatigue = 0;
  let opponentPitcherExtraFatigue = 0;

  // Calculate synergies once at match start (derived state from lineup traits)
  const mySynergies = calculateSynergies(myTeam);
  const opponentSynergies = calculateSynergies(opponentTeam);

  // Cross-inning batter history for narrative context (slumps, streaks, redemption)
  const myBatterHistory = new Map<string, BatterHistory>();
  const opponentBatterHistory = new Map<string, BatterHistory>();

  let inning = 0;
  const MAX_INNINGS = 18; // Safety limit for extra innings

  while (inning < MAX_INNINGS) {
    const inningNumber = inning + 1;

    const gameTrace = getTrace();

    // Check if we need to change pitchers based on rotation rules
    if (
      inning === GAME_CONSTANTS.PITCHER_ROTATION.FIRST_RELIEVER_INNING &&
      myRelieverIndex < myRelievers.length
    ) {
      const oldPitcher = myCurrentPitcher;
      myCurrentPitcher = myRelievers[myRelieverIndex];
      myCurrentPitcherInnings = 0;
      myPitcherExtraFatigue = 0; // Fresh arm
      myRelieverIndex++;
      gameTrace?.logGameEvent({ type: "pitcher_change", inning: inningNumber, team: "home", oldPitcherName: oldPitcher.name, newPitcherName: myCurrentPitcher.name, reason: "first_reliever" });
    } else if (
      inning === GAME_CONSTANTS.PITCHER_ROTATION.SECOND_RELIEVER_INNING &&
      myRelieverIndex < myRelievers.length
    ) {
      const oldPitcher = myCurrentPitcher;
      myCurrentPitcher = myRelievers[myRelieverIndex];
      myCurrentPitcherInnings = 0;
      myPitcherExtraFatigue = 0; // Fresh arm
      myRelieverIndex++;
      gameTrace?.logGameEvent({ type: "pitcher_change", inning: inningNumber, team: "home", oldPitcherName: oldPitcher.name, newPitcherName: myCurrentPitcher.name, reason: "second_reliever" });
    }

    if (
      inning === GAME_CONSTANTS.PITCHER_ROTATION.FIRST_RELIEVER_INNING &&
      opponentRelieverIndex < opponentRelievers.length
    ) {
      const oldPitcher = opponentCurrentPitcher;
      opponentCurrentPitcher = opponentRelievers[opponentRelieverIndex];
      opponentCurrentPitcherInnings = 0;
      opponentPitcherExtraFatigue = 0; // Fresh arm
      opponentRelieverIndex++;
      gameTrace?.logGameEvent({ type: "pitcher_change", inning: inningNumber, team: "away", oldPitcherName: oldPitcher.name, newPitcherName: opponentCurrentPitcher.name, reason: "first_reliever" });
    } else if (
      inning === GAME_CONSTANTS.PITCHER_ROTATION.SECOND_RELIEVER_INNING &&
      opponentRelieverIndex < opponentRelievers.length
    ) {
      const oldPitcher = opponentCurrentPitcher;
      opponentCurrentPitcher = opponentRelievers[opponentRelieverIndex];
      opponentCurrentPitcherInnings = 0;
      opponentPitcherExtraFatigue = 0; // Fresh arm
      opponentRelieverIndex++;
      gameTrace?.logGameEvent({ type: "pitcher_change", inning: inningNumber, team: "away", oldPitcherName: oldPitcher.name, newPitcherName: opponentCurrentPitcher.name, reason: "second_reliever" });
    }

    if (emitEvents) {
      gameEvents.emit({
        type: "inning_start",
        inning: inningNumber,
        isTop: true,
      });
    }
    gameTrace?.logGameEvent({ type: "inning_start", inning: inningNumber, isTop: true });

    // Top of inning: Opponent bats (my team pitches)
    const opponentInning = simulateInningWithStats(
      opponentTeam,
      myTeam,
      myCurrentPitcher,
      myCurrentPitcherInnings,
      opponentBatterIndex,
      inningNumber,
      true,
      rng,
      opponentBatterSpirit,
      opponentRuns,
      myRuns,
      myPitcherExtraFatigue,
      opponentSynergies, // offense synergies (opponent is batting)
      mySynergies,       // defense synergies (my team is pitching)
      opponentBatterHistory
    );
    opponentRuns += opponentInning.runs;
    opponentBatterIndex = opponentInning.nextBatterIndex;
    myCurrentPitcherInnings++;
    myPitcherExtraFatigue = opponentInning.extraPitcherFatigue;
    allPlays.push(...opponentInning.plays);

    // Track stats for this pitcher
    if (!myPitchersUsed.has(myCurrentPitcher.id)) {
      myPitchersUsed.set(myCurrentPitcher.id, {
        hitsAllowed: 0,
        runsAllowed: 0,
        strikeouts: 0,
        walks: 0,
        inningsPitched: 0,
        homeRunsAllowed: 0,
      });
    }
    const myPitcherStat = myPitchersUsed.get(myCurrentPitcher.id)!;
    myPitcherStat.hitsAllowed += opponentInning.pitcherStats.hitsAllowed;
    myPitcherStat.runsAllowed += opponentInning.pitcherStats.runsAllowed;
    myPitcherStat.strikeouts += opponentInning.pitcherStats.strikeouts;
    myPitcherStat.walks += opponentInning.pitcherStats.walks;
    myPitcherStat.homeRunsAllowed += opponentInning.pitcherStats.homeRunsAllowed;
    myPitcherStat.inningsPitched++;

    // Merge opponent batter stats
    opponentInning.batterStats.forEach((stats, playerId) => {
      if (!opponentBatterStats.has(playerId)) {
        opponentBatterStats.set(playerId, {
          hits: 0,
          abs: 0,
          strikeouts: 0,
          walks: 0,
          runs: 0,
          rbis: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
        });
      }
      const existing = opponentBatterStats.get(playerId)!;
      existing.hits += stats.hits;
      existing.abs += stats.abs;
      existing.strikeouts += stats.strikeouts;
      existing.walks += stats.walks;
      existing.runs += stats.runs;
      existing.rbis += stats.rbis;
      existing.doubles += stats.doubles;
      existing.triples += stats.triples;
      existing.homeRuns += stats.homeRuns;
    });

    if (emitEvents) {
      gameEvents.emit({
        type: "inning_end",
        inning: inningNumber,
        isTop: true,
        runs: opponentInning.runs,
        hits: opponentInning.pitcherStats.hitsAllowed,
      });
    }
    gameTrace?.logGameEvent({ type: "inning_end", inning: inningNumber, isTop: true, runs: opponentInning.runs, hits: opponentInning.pitcherStats.hitsAllowed });

    // Check if we need bottom of inning
    // Skip bottom half if home team (myTeam) is already winning after 9+ innings
    if (inningNumber >= 9 && myRuns > opponentRuns) {
      break; // Home team wins, no need for bottom half
    }

    if (emitEvents) {
      gameEvents.emit({
        type: "inning_start",
        inning: inningNumber,
        isTop: false,
      });
    }
    gameTrace?.logGameEvent({ type: "inning_start", inning: inningNumber, isTop: false });

    // Bottom of inning: My team bats (opponent pitches)
    const myInning = simulateInningWithStats(
      myTeam,
      opponentTeam,
      opponentCurrentPitcher,
      opponentCurrentPitcherInnings,
      myBatterIndex,
      inningNumber,
      false,
      rng,
      myBatterSpirit,
      myRuns,
      opponentRuns,
      opponentPitcherExtraFatigue,
      mySynergies,       // offense synergies (my team is batting)
      opponentSynergies, // defense synergies (opponent is pitching)
      myBatterHistory
    );
    myRuns += myInning.runs;
    myBatterIndex = myInning.nextBatterIndex;
    opponentCurrentPitcherInnings++;
    opponentPitcherExtraFatigue = myInning.extraPitcherFatigue;
    allPlays.push(...myInning.plays);

    // Track stats for this pitcher
    if (!opponentPitchersUsed.has(opponentCurrentPitcher.id)) {
      opponentPitchersUsed.set(opponentCurrentPitcher.id, {
        hitsAllowed: 0,
        runsAllowed: 0,
        strikeouts: 0,
        walks: 0,
        inningsPitched: 0,
        homeRunsAllowed: 0,
      });
    }
    const opponentPitcherStat = opponentPitchersUsed.get(
      opponentCurrentPitcher.id
    )!;
    opponentPitcherStat.hitsAllowed += myInning.pitcherStats.hitsAllowed;
    opponentPitcherStat.runsAllowed += myInning.pitcherStats.runsAllowed;
    opponentPitcherStat.strikeouts += myInning.pitcherStats.strikeouts;
    opponentPitcherStat.walks += myInning.pitcherStats.walks;
    opponentPitcherStat.homeRunsAllowed += myInning.pitcherStats.homeRunsAllowed;
    opponentPitcherStat.inningsPitched++;

    // Merge batter stats
    myInning.batterStats.forEach((stats, playerId) => {
      if (!myBatterStats.has(playerId)) {
        myBatterStats.set(playerId, {
          hits: 0,
          abs: 0,
          strikeouts: 0,
          walks: 0,
          runs: 0,
          rbis: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
        });
      }
      const existing = myBatterStats.get(playerId)!;
      existing.hits += stats.hits;
      existing.abs += stats.abs;
      existing.strikeouts += stats.strikeouts;
      existing.walks += stats.walks;
      existing.runs += stats.runs;
      existing.rbis += stats.rbis;
      existing.doubles += stats.doubles;
      existing.triples += stats.triples;
      existing.homeRuns += stats.homeRuns;
    });

    if (emitEvents) {
      gameEvents.emit({
        type: "inning_end",
        inning: inningNumber,
        isTop: false,
        runs: myInning.runs,
        hits: myInning.pitcherStats.hitsAllowed,
      });
    }
    gameTrace?.logGameEvent({ type: "inning_end", inning: inningNumber, isTop: false, runs: myInning.runs, hits: myInning.pitcherStats.hitsAllowed });

    // Check if game is over (after 9+ innings and not tied)
    if (inningNumber >= 9 && myRuns !== opponentRuns) {
      break;
    }

    inning++;
  }

  if (emitEvents) {
    gameEvents.emit({
      type: "game_end",
      homeRuns: myRuns,
      awayRuns: opponentRuns,
      isWin: myRuns > opponentRuns,
    });
  }

  // Build boxscore — deduplicate players first since small rosters cycle IDs
  const uniqueMyBatters = myTeam.filter(isBatter).filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  const uniqueOpponentBatters = opponentTeam.filter(isBatter).filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

  const myBatters: PlayerBoxScore[] = uniqueMyBatters.map((p) => {
    const stats = myBatterStats.get(p.id) || {
      hits: 0,
      abs: 0,
      strikeouts: 0,
      walks: 0,
      runs: 0,
      rbis: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
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
      doubles: stats.doubles,
      triples: stats.triples,
      homeRuns: stats.homeRuns,
    };
  });

  const opponentBatters: PlayerBoxScore[] = uniqueOpponentBatters.map((p) => {
    const stats = opponentBatterStats.get(p.id) || {
      hits: 0,
      abs: 0,
      strikeouts: 0,
      walks: 0,
      runs: 0,
      rbis: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
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
      doubles: stats.doubles,
      triples: stats.triples,
      homeRuns: stats.homeRuns,
    };
  });

  // Build pitcher box scores from individual pitchers used
  const myPitchersBox: PitcherBoxScore[] = Array.from(
    myPitchersUsed.entries()
  ).map(([pitcherId, stats]) => {
    const pitcher = myPitchers.find((p) => p.id === pitcherId)!;
    return {
      playerId: pitcherId,
      name: pitcher.name,
      inningsPitched: stats.inningsPitched,
      hitsAllowed: stats.hitsAllowed,
      runsAllowed: stats.runsAllowed,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
      homeRunsAllowed: stats.homeRunsAllowed,
    };
  });

  const opponentPitchersBox: PitcherBoxScore[] = Array.from(
    opponentPitchersUsed.entries()
  ).map(([pitcherId, stats]) => {
    const pitcher = opponentPitchers.find((p) => p.id === pitcherId)!;
    return {
      playerId: pitcherId,
      name: pitcher.name,
      inningsPitched: stats.inningsPitched,
      hitsAllowed: stats.hitsAllowed,
      runsAllowed: stats.runsAllowed,
      strikeouts: stats.strikeouts,
      walks: stats.walks,
      homeRunsAllowed: stats.homeRunsAllowed,
    };
  });

  const boxScore: BoxScore = {
    myBatters,
    myPitchers: myPitchersBox,
    opponentBatters,
    opponentPitchers: opponentPitchersBox,
    myHits: Array.from(myBatterStats.values()).reduce(
      (sum, s) => sum + s.hits,
      0
    ),
    opponentHits: Array.from(opponentBatterStats.values()).reduce(
      (sum, s) => sum + s.hits,
      0
    ),
  };

  const totalInnings = inning + 1; // inning is 0-indexed

  return { myRuns, opponentRuns, boxScore, playByPlay: allPlays, totalInnings };
}

export function generateOpponentTeam(_teamStrength: number): Team {
  // Generate a full opponent team (with scaling based on player strength)
  const varianceMin = GAME_CONSTANTS.OPPONENT.STRENGTH_VARIANCE_MIN;
  const varianceMax = GAME_CONSTANTS.OPPONENT.STRENGTH_VARIANCE_MAX;
  const variance = varianceMin + Math.random() * (varianceMax - varianceMin);
  // Note: This function is legacy - league system should use leagueGenerator instead
  // Default to SANDLOT tier for standalone matches
  const roster = generateStarterTeam(getDefaultRandomProvider(), "SANDLOT");

  // TODO: Use _teamStrength to scale opponent difficulty (league tiers)

  // Scale opponent stats to match player's team strength
  const scaledRoster = roster.map((player) => {
    if (isBatter(player)) {
      const stats = player.stats as BatterStats;
      return {
        ...player,
        stats: {
          power: Math.floor(stats.power * variance),
          contact: Math.floor(stats.contact * variance),
          glove: Math.floor(stats.glove * variance),
          speed: Math.floor(stats.speed * variance),
        },
      };
    } else {
      const stats = player.stats as PitcherStats;
      return {
        ...player,
        stats: {
          velocity: Math.floor(stats.velocity * variance),
          control: Math.floor(stats.control * variance),
          break: Math.floor(stats.break * variance),
        },
      };
    }
  });

  // Build lineup - cycle through available players to fill standard positions
  const batters = scaledRoster.filter(isBatter);
  const starters = scaledRoster.filter((p) => p.role === "Starter");
  const relievers = scaledRoster.filter((p) => p.role === "Reliever");

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

  const lineupIds = [...batterLineup, ...starterLineup, ...relieverLineup];

  return {
    cash: 0,
    fans: 1.0,
    roster: scaledRoster,
    lineup: lineupIds,
    wins: 0,
    losses: 0,
  };
}

export function simulateMatch(
  myTeam: Team,
  opponentTeam: Team,
  enableTrace: boolean = false,
  matchRewards?: { win: number; loss: number }
): MatchResult {
  // Get lineup players for both teams
  const myLineupPlayers = myTeam.lineup
    .map((id) => myTeam.roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  const opponentLineupPlayers = opponentTeam.lineup
    .map((id) => opponentTeam.roster.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  // When trace is enabled, use a seeded RNG for reproducibility
  const collector = enableTrace ? new GameTraceCollector() : null;
  const seed = enableTrace ? Date.now() : undefined;
  const rng = enableTrace ? new SeededRandomProvider(seed!) : undefined;
  if (collector && seed !== undefined) {
    collector.seed = seed;
  }

  const runGame = () => simulateGame(
    myLineupPlayers,
    opponentLineupPlayers,
    true, // emit events for live game
    rng
  );

  // Simulate the full game (wrapped in trace context if enabled)
  const { myRuns, opponentRuns, boxScore, playByPlay, totalInnings } =
    collector ? withTrace(collector, runGame) : runGame();

  const isWin = myRuns > opponentRuns;

  // Calculate rewards — use tier-specific amounts when provided, otherwise fall back to global defaults
  const winBase = matchRewards?.win ?? GAME_CONSTANTS.MATCH_REWARDS.BASE_WIN;
  const lossBase = matchRewards?.loss ?? GAME_CONSTANTS.MATCH_REWARDS.BASE_LOSS;
  const cashEarned = isWin
    ? Math.floor(winBase * myTeam.fans)
    : lossBase;

  return {
    myRuns,
    opponentRuns,
    isWin,
    cashEarned,
    boxScore,
    playByPlay,
    totalInnings,
    myTeamColor: myTeam.colors?.primary,
    opponentTeamColor: opponentTeam.colors?.primary,
    traceLog: collector?.build({ home: myRuns, away: opponentRuns }, totalInnings),
  };
}

// Export internal functions for testing
export { simulateInningWithStats, simulateGame };
