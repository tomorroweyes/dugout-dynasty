/**
 * Win Expectancy & Leverage Index
 *
 * Computes real leverage index (LI) using a Poisson win probability model.
 *
 *   WE  = P(batting team wins the game from the current state)
 *   LI  = E[|ΔWE| per plate appearance] / AVG_PA_WE_SWING
 *
 * Sources:
 *   RE24 table  — Tom Tango, "The Book" / Retrosheet empirical data
 *   Outcome probabilities — contemporary MLB averages (~2020–2024)
 *   AVG_PA_WE_SWING — empirical MLB constant ≈ 0.040
 */

import type { InteractiveMatchState } from "./interactiveMatchEngine";

// ---------------------------------------------------------------------------
// RE24: Expected runs to score for the rest of the CURRENT half-inning,
// indexed by [outs][baseState bitmask].
//
// baseState bitmask encoding:
//   bit 0 (value 1) = runner on 1st
//   bit 1 (value 2) = runner on 2nd
//   bit 2 (value 4) = runner on 3rd
//
// Column order:  ∅    1st  2nd  1&2  3rd  1&3  2&3  load
// ---------------------------------------------------------------------------
const RE24: readonly (readonly number[])[] = [
  [0.51, 0.88, 1.12, 1.37, 1.49, 1.72, 1.96, 2.33], // 0 outs
  [0.27, 0.54, 0.72, 0.97, 0.97, 1.19, 1.41, 1.62], // 1 out
  [0.10, 0.23, 0.34, 0.43, 0.45, 0.58, 0.64, 0.79], // 2 outs
] as const;

/** Average runs per half-inning (= RE24 with empty bases, 0 outs). */
const RUNS_PER_HALF_INNING = 0.51;

/**
 * League-average absolute WE change per plate appearance.
 * Empirical MLB value; normalises raw WE swings into the 0–∞ LI scale.
 */
const AVG_PA_WE_SWING = 0.040;

// ---------------------------------------------------------------------------
// Outcome probabilities (contemporary MLB averages, sum = 1.000)
// For LI we use four representative outcomes; doubles/triples are folded into
// "single" (base-advancement differences matter less than the hit/out split).
// ---------------------------------------------------------------------------
const P_OUT    = 0.713; // all outs (K + groundout + flyout + …)
const P_WALK   = 0.082; // walk / HBP
const P_SINGLE = 0.165; // 1B + 2B (approximated as single for advancement)
const P_HR     = 0.040; // HR + triple (approximated as home run)

// ---------------------------------------------------------------------------
// Base-advancement helpers (mirror logic from outcomeConfig.ts BaseAdvancementRules)
// ---------------------------------------------------------------------------

function basesToState(bases: [boolean, boolean, boolean]): number {
  return (bases[0] ? 1 : 0) | (bases[1] ? 2 : 0) | (bases[2] ? 4 : 0);
}

function applyOut(baseState: number): { baseState: number; runs: number } {
  // Runners hold; outs is incremented by the caller.
  return { baseState, runs: 0 };
}

function applyWalk(baseState: number): { baseState: number; runs: number } {
  const first  = !!(baseState & 1);
  const second = !!(baseState & 2);
  const third  = !!(baseState & 4);
  const runs = first && second && third ? 1 : 0;
  const newFirst  = true;
  const newSecond = first || second;
  const newThird  = (first && second) || third;
  return {
    baseState: (newFirst ? 1 : 0) | (newSecond ? 2 : 0) | (newThird ? 4 : 0),
    runs,
  };
}

function applySingle(baseState: number): { baseState: number; runs: number } {
  const first  = !!(baseState & 1);
  const second = !!(baseState & 2);
  const third  = !!(baseState & 4);
  const runs = third ? 1 : 0;
  // Batter → 1st; 1st → 2nd; 2nd → 3rd; 3rd scores
  return {
    baseState: 1 | (first ? 2 : 0) | (second ? 4 : 0),
    runs,
  };
}

function applyHomerun(baseState: number): { baseState: number; runs: number } {
  const runners = (baseState & 1 ? 1 : 0) + (baseState & 2 ? 1 : 0) + (baseState & 4 ? 1 : 0);
  return { baseState: 0, runs: runners + 1 };
}

// ---------------------------------------------------------------------------
// Poisson win-probability model
// ---------------------------------------------------------------------------

/**
 * Poisson PMF — log-space for numerical stability.
 */
function poissonPMF(k: number, lambda: number): number {
  if (k < 0) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;
  let logP = -lambda;
  for (let i = 1; i <= k; i++) logP += Math.log(lambda / i);
  return Math.exp(logP);
}

/**
 * P(batting team wins) where:
 *   X ~ Poisson(lambdaB) = future runs for batting team
 *   Y ~ Poisson(lambdaF) = future runs for fielding team
 *   runDiff = current batting-team run lead (positive = batting team ahead)
 *
 * Ties go to extra innings, modelled as 50/50, which is equivalent to:
 *   P(win) = P(X − Y > −runDiff) + 0.5 × P(X − Y = −runDiff)
 *
 * For total expected runs < 2 the Normal approximation is unreliable;
 * we use an exact convolution instead.
 */
function poissonWinProb(runDiff: number, lambdaB: number, lambdaF: number): number {
  if (lambdaB + lambdaF < 0.001) {
    return runDiff > 0 ? 1.0 : runDiff < 0 ? 0.0 : 0.5;
  }

  if (lambdaB + lambdaF < 2.5) {
    // Exact convolution for small lambda (Normal breaks down here)
    return exactPoissonWinProb(runDiff, lambdaB, lambdaF);
  }

  // Normal approximation: X − Y ~ N(lambdaB − lambdaF, lambdaB + lambdaF)
  // Not subtracting 0.5 continuity correction intentionally gives the correct
  // "50% tie → extra innings" formula: Φ((runDiff + lambdaB − lambdaF) / σ)
  const sigma = Math.sqrt(lambdaB + lambdaF);
  const z = (runDiff + lambdaB - lambdaF) / sigma;
  return logisticCDF(z);
}

/**
 * Exact Poisson win probability via direct convolution.
 * Used when lambdaB + lambdaF < 2.5 (Normal breaks down for thin tails).
 */
function exactPoissonWinProb(runDiff: number, lambdaB: number, lambdaF: number): number {
  const maxK = Math.max(20, Math.ceil((lambdaB + lambdaF) * 5 + 10));
  let winProb = 0;

  for (let b = 0; b <= maxK; b++) {
    const pB = poissonPMF(b, lambdaB);
    if (pB < 1e-12) continue;

    // Batting team has b future runs.
    // They win outright if b + runDiff > f  →  f < b + runDiff
    // They tie (50%) if f = b + runDiff
    const threshold = b + runDiff; // fielder must score < threshold to lose outright

    let pFielderLess = 0;
    for (let f = 0; f < threshold; f++) {
      if (f < 0) break;
      pFielderLess += poissonPMF(f, lambdaF);
    }

    const pTie = threshold >= 0 ? poissonPMF(threshold, lambdaF) : 0;
    winProb += pB * (pFielderLess + 0.5 * pTie);
  }

  return Math.max(0, Math.min(1, winProb));
}

/**
 * Logistic approximation of the standard normal CDF.
 * Max error ≈ ±0.02; sufficient for LI computation.
 */
function logisticCDF(z: number): number {
  return 1 / (1 + Math.exp(-1.7 * z));
}

// ---------------------------------------------------------------------------
// Win Expectancy
// ---------------------------------------------------------------------------

interface WEState {
  inning: number;    // 1–9 (capped at 9 for extra innings)
  isTop: boolean;    // true = away (opponent) batting
  outs: number;      // 0–2
  baseState: number; // 0–7 bitmask
  runDiff: number;   // batting team runs − fielding team runs
}

/**
 * P(batting team wins the game) from the given state.
 *
 * Future run expectations:
 *   In top of inning N:
 *     Batter (away): tops N+1 … 9           = (9 − N) future half-innings
 *     Fielder (home): bottoms N … 9         = (10 − N) future half-innings
 *   In bottom of inning N:
 *     Batter (home): bottoms N+1 … 9        = (9 − N) future half-innings
 *     Fielder (away): tops N+1 … 9          = (9 − N) future half-innings
 *
 * lambdaB = RE24[outs][baseState]  (current inning)
 *         + batterFutureHalfInnings × RUNS_PER_HALF_INNING
 * lambdaF = fielderFutureHalfInnings × RUNS_PER_HALF_INNING
 */
function winExpectancy(state: WEState): number {
  const inningN = Math.min(state.inning, 9);
  const re = RE24[state.outs][state.baseState];

  const batterFuture  = Math.max(0, 9 - inningN);
  const fielderFuture = state.isTop
    ? Math.max(0, 10 - inningN) // home bats bottom of this inning + future innings
    : Math.max(0, 9 - inningN); // away already batted; only future tops

  const lambdaB = re + batterFuture * RUNS_PER_HALF_INNING;
  const lambdaF = fielderFuture * RUNS_PER_HALF_INNING;

  return poissonWinProb(state.runDiff, lambdaB, lambdaF);
}

/**
 * WE after a half-inning ends (outs reached 3).
 * The fielding team becomes the new batting team; perspective flips.
 * Returns WE from the ORIGINAL batting team's perspective.
 */
function weAfterInningEnd(
  inning: number,
  isTop: boolean,
  runDiff: number  // batting team's run lead after scoring this half-inning
): number {
  const newBatterRunDiff = -runDiff;

  if (isTop) {
    // End of top half → bottom of same inning
    const weNewBatter = winExpectancy({
      inning,
      isTop: false,
      outs: 0,
      baseState: 0,
      runDiff: newBatterRunDiff,
    });
    return 1 - weNewBatter;
  } else {
    // End of bottom half → top of next inning
    const nextInning = inning + 1;
    const weNewBatter = winExpectancy({
      inning: nextInning,
      isTop: true,
      outs: 0,
      baseState: 0,
      runDiff: newBatterRunDiff,
    });
    return 1 - weNewBatter;
  }
}

/**
 * WE after a single PA outcome resolves.
 * Handles half-inning end (outs = 3) via perspective flip.
 * Returns WE from the CURRENT batting team's perspective.
 */
function weAfterOutcome(
  state: WEState,
  newOuts: number,
  newBaseState: number,
  runsScored: number
): number {
  const newRunDiff = state.runDiff + runsScored;

  if (newOuts >= 3) {
    return weAfterInningEnd(state.inning, state.isTop, newRunDiff);
  }

  return winExpectancy({
    inning:    state.inning,
    isTop:     state.isTop,
    outs:      newOuts,
    baseState: newBaseState,
    runDiff:   newRunDiff,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the real leverage index for the current at-bat.
 *
 * LI = E[|ΔWE| per PA] / AVG_PA_WE_SWING
 *
 * Four representative outcomes are simulated (out, walk, single, home run)
 * weighted by contemporary MLB probabilities.
 * Average LI ≈ 1.0.  High leverage (≥ 2.0) ≈ top 10% of real game situations.
 */
export function computeLeverageIndex(state: InteractiveMatchState): number {
  const inning    = state.inning;
  const isTop     = state.isTop;
  const outs      = state.outs;
  const baseState = basesToState(state.bases);
  const runDiff   = isTop
    ? state.opponentRuns - state.myRuns  // opponent batting
    : state.myRuns - state.opponentRuns; // my team batting

  const currentWE = winExpectancy({ inning, isTop, outs, baseState, runDiff });

  // --- out ---
  const outResult  = applyOut(baseState);
  const weOut      = weAfterOutcome({ inning, isTop, outs, baseState, runDiff }, outs + 1, outResult.baseState, 0);

  // --- walk ---
  const walkResult = applyWalk(baseState);
  const weWalk     = weAfterOutcome({ inning, isTop, outs, baseState, runDiff }, outs, walkResult.baseState, walkResult.runs);

  // --- single ---
  const sinResult  = applySingle(baseState);
  const weSingle   = weAfterOutcome({ inning, isTop, outs, baseState, runDiff }, outs, sinResult.baseState, sinResult.runs);

  // --- home run ---
  const hrResult   = applyHomerun(baseState);
  const weHR       = weAfterOutcome({ inning, isTop, outs, baseState, runDiff }, outs, hrResult.baseState, hrResult.runs);

  const expectedAbsSwing =
    P_OUT    * Math.abs(weOut    - currentWE) +
    P_WALK   * Math.abs(weWalk   - currentWE) +
    P_SINGLE * Math.abs(weSingle - currentWE) +
    P_HR     * Math.abs(weHR     - currentWE);

  return expectedAbsSwing / AVG_PA_WE_SWING;
}
