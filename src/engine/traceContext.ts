/**
 * Engine Trace Context
 *
 * Module-scoped context for trace collection. Engine code reads the active
 * collector via getTrace() without any signature changes. Call sites wrap
 * simulation in withTrace() to enable collection for that run.
 */

import type {
  GameTraceLog,
  AtBatTrace,
  GameLevelEvent,
  RngRoll,
  StatPipeline,
  ResolutionBranch,
  ApproachTrace,
  AbilityTrace,
  ExtraBaseTrace,
  SpiritTrace,
  OutcomeModifierTrace,
} from "@/types/trace";

// ============================================
// MODULE-SCOPED CONTEXT
// ============================================

let activeCollector: GameTraceCollector | null = null;

/**
 * Run a function with trace collection enabled.
 * The collector is active for the duration of `fn` and cleared after.
 */
export function withTrace<T>(collector: GameTraceCollector, fn: () => T): T {
  activeCollector = collector;
  try {
    return fn();
  } finally {
    activeCollector = null;
  }
}

/**
 * Get the currently active trace collector, or null if tracing is disabled.
 * Engine code calls this to check whether to log.
 */
export function getTrace(): GameTraceCollector | null {
  return activeCollector;
}

/**
 * Set the active trace collector directly (for interactive mode where
 * simulation spans multiple function calls rather than a single withTrace scope).
 */
export function setActiveTrace(collector: GameTraceCollector | null): void {
  activeCollector = collector;
}

// ============================================
// COLLECTOR IMPLEMENTATION
// ============================================

export class GameTraceCollector {
  private atBats: AtBatTrace[] = [];
  private gameEvents: GameLevelEvent[] = [];
  private currentAtBat: Partial<AtBatTrace> | null = null;
  private currentRolls: RngRoll[] = [];
  private currentExtraBases: ExtraBaseTrace[] = [];
  private atBatIndex = 0;
  seed?: number;

  beginAtBat(context: {
    inning: number;
    isTop: boolean;
    batterId: string;
    batterName: string;
    pitcherId: string;
    pitcherName: string;
    outsBefore: number;
    basesBefore: [boolean, boolean, boolean];
  }): void {
    this.currentAtBat = { ...context, index: this.atBatIndex++ };
    this.currentRolls = [];
    this.currentExtraBases = [];
  }

  logRoll(label: string, rawValue: number, scaledValue?: number, threshold?: number, passed: boolean = false): void {
    this.currentRolls.push({ label, rawValue, scaledValue, threshold, passed });
  }

  logStatPipeline(pipeline: StatPipeline): void {
    if (this.currentAtBat) this.currentAtBat.statPipeline = pipeline;
  }

  logOutcomeModifiers(modifiers: OutcomeModifierTrace): void {
    if (this.currentAtBat) this.currentAtBat.outcomeModifiers = modifiers;
  }

  logResolution(resolution: ResolutionBranch): void {
    if (this.currentAtBat) this.currentAtBat.resolution = resolution;
  }

  logApproach(approach: ApproachTrace): void {
    if (this.currentAtBat) this.currentAtBat.approach = approach;
  }

  logAbilities(abilities: AbilityTrace): void {
    if (this.currentAtBat) this.currentAtBat.abilities = abilities;
  }

  logExtraBase(trace: ExtraBaseTrace): void {
    this.currentExtraBases.push(trace);
  }

  logSpirit(spirit: SpiritTrace): void {
    if (this.currentAtBat) this.currentAtBat.spirit = spirit;
  }

  endAtBat(outcome: string, runsScored: number, outsAfter: number, basesAfter: [boolean, boolean, boolean]): void {
    if (this.currentAtBat) {
      this.atBats.push({
        ...this.currentAtBat,
        rolls: this.currentRolls,
        extraBases: this.currentExtraBases,
        outcome,
        runsScored,
        outsAfter,
        basesAfter,
      } as AtBatTrace);
    }
    this.currentAtBat = null;
  }

  logGameEvent(event: GameLevelEvent): void {
    this.gameEvents.push(event);
  }

  /** Temporary staging area for pitcher pipeline data before both sides are computed */
  _pendingPitcherPipeline?: StatPipeline["pitcher"];

  /**
   * Merge the staged pitcher pipeline into the current at-bat's stat pipeline.
   * Called once both batter and pitcher stats have been computed for an at-bat.
   */
  mergePitcherPipeline(defenseGlove: number): void {
    if (this.currentAtBat?.statPipeline && this._pendingPitcherPipeline) {
      this.currentAtBat.statPipeline.pitcher = this._pendingPitcherPipeline;
      this.currentAtBat.statPipeline.defenseGlove = defenseGlove;
    }
    delete this._pendingPitcherPipeline;
  }

  build(finalScore: { home: number; away: number }, totalInnings: number): GameTraceLog {
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      seed: this.seed,
      atBats: this.atBats,
      gameEvents: this.gameEvents,
      finalScore,
      totalInnings,
    };
  }
}
