import { describe, it, expect } from "vitest";
import type { Team } from "@/types/game";
import { generateStarterTeam } from "../playerGenerator";
import { SeededRandomProvider } from "../randomProvider";
import {
  initializeInteractiveMatch,
  simulateAtBat_Interactive,
  finalizeInteractiveMatch,
} from "../interactiveMatchEngine";

function createTeam(id: string, seed: number): Team {
  const roster = generateStarterTeam(new SeededRandomProvider(seed), "SANDLOT");
  return {
    id,
    cash: 5000,
    fans: 1,
    roster,
    lineup: roster.map((player) => player.id),
    wins: 0,
    losses: 0,
    colors: {
      primary: "#1E40AF",
      secondary: "#DBEAFE",
    },
  };
}

function runSeededInteractiveSimulation(seed: number) {
  const myTeam = createTeam("my-team", 101);
  const opponentTeam = createTeam("opp-team", 202);

  let state = initializeInteractiveMatch(myTeam, opponentTeam, seed, false);
  let steps = 0;
  const maxSteps = 2000;

  while (!state.isComplete && steps < maxSteps) {
    state = simulateAtBat_Interactive(state, {
      batterApproach: state.isTop ? undefined : "contact",
      pitchStrategy: state.isTop ? "finesse" : undefined,
    });
    steps += 1;
  }

  expect(steps).toBeLessThan(maxSteps);

  const result = finalizeInteractiveMatch(state, { win: 500, loss: 250 }, 1);

  return {
    score: [result.myRuns, result.opponentRuns],
    isWin: result.isWin,
    cashEarned: result.cashEarned,
    totalInnings: result.totalInnings,
    plays: result.playByPlay?.map((play) => ({
      inning: play.inning,
      isTop: play.isTop,
      outcome: play.outcome,
      outs: play.outs,
      rbi: play.rbi ?? 0,
      batterApproach: play.batterApproach ?? null,
      pitchStrategy: play.pitchStrategy ?? null,
    })),
    lootCount: result.lootDrops?.length ?? 0,
  };
}

describe("interactiveMatchEngine deterministic parity", () => {
  it("produces identical results for same seed and decision policy", () => {
    const runA = runSeededInteractiveSimulation(424242);
    const runB = runSeededInteractiveSimulation(424242);

    expect(runA).toEqual(runB);
  });
});
