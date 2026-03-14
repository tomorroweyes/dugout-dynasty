import { describe, it, expect } from "vitest";
import type { Team } from "@/types/game";
import { generateStarterTeam } from "../playerGenerator";
import { SeededRandomProvider } from "../randomProvider";
import {
  initializeInteractiveMatch,
  simulateAtBat_Interactive,
  finalizeInteractiveMatch,
  derivePitcherFatigueLevel,
  type AtBatDecision,
} from "../interactiveMatchEngine";
import type { ZoneModifier } from "../zoneSystem";

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

describe("derivePitcherFatigueLevel", () => {
  // fresh: innings <= 4 AND fatigue < 0.8
  it("returns 'fresh' when well under both thresholds", () => {
    expect(derivePitcherFatigueLevel(0, 0.0)).toBe("fresh");
    expect(derivePitcherFatigueLevel(3, 0.4)).toBe("fresh");
    expect(derivePitcherFatigueLevel(4, 0.5)).toBe("fresh");
  });

  it("returns 'tired' when innings exceed fresh threshold", () => {
    expect(derivePitcherFatigueLevel(5, 0.4)).toBe("tired");
  });

  it("returns 'tired' when fatigue reaches the fresh threshold", () => {
    expect(derivePitcherFatigueLevel(3, 0.8)).toBe("tired");
  });

  it("returns 'tired' when both thresholds crossed but below gassed", () => {
    expect(derivePitcherFatigueLevel(5, 1.4)).toBe("tired");
  });

  // gassed: innings >= 6 OR fatigue >= 1.5
  it("returns 'gassed' when innings hit the gassed threshold", () => {
    expect(derivePitcherFatigueLevel(6, 0.0)).toBe("gassed");
    expect(derivePitcherFatigueLevel(7, 0.0)).toBe("gassed");
  });

  it("returns 'gassed' when fatigue hits the gassed threshold", () => {
    expect(derivePitcherFatigueLevel(0, 1.5)).toBe("gassed");
    expect(derivePitcherFatigueLevel(2, 2.0)).toBe("gassed");
  });

  it("returns 'gassed' when both gassed conditions are met", () => {
    expect(derivePitcherFatigueLevel(6, 1.5)).toBe("gassed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// zoneLanded — play-by-play records actual pitch landing, not just aim
// ─────────────────────────────────────────────────────────────────────────────
//
// The zone grid resolves landing via resolvePitchLanding() which applies
// control variance — low-control pitchers can miss their aimed zone.
// PlayByPlayEvent.zoneLanded must reflect the actual landing zone so the
// zone grid result display (⚾ icon) shows where the pitch ACTUALLY went,
// not where the pitcher AIMED.

describe("zoneLanded in PlayByPlayEvent", () => {
  function makeMatch(seed: number) {
    const myTeam: Team = {
      id: "my-team",
      cash: 5000,
      fans: 1,
      roster: generateStarterTeam(new SeededRandomProvider(seed), "SANDLOT"),
      lineup: [],
      wins: 0,
      losses: 0,
      colors: { primary: "#1E40AF", secondary: "#DBEAFE" },
    };
    myTeam.lineup = myTeam.roster.map((p) => p.id);

    const oppTeam: Team = {
      ...myTeam,
      id: "opp-team",
      roster: generateStarterTeam(new SeededRandomProvider(seed + 1), "SANDLOT"),
    };
    oppTeam.lineup = oppTeam.roster.map((p) => p.id);

    return initializeInteractiveMatch(myTeam, oppTeam, seed, false);
  }

  function fakeZoneResult(
    override: Partial<ZoneModifier> = {}
  ): ZoneModifier {
    return {
      strikeoutBonus: 0,
      hitBonus: 0,
      homerunBonus: 0,
      walkBonus: 0,
      isPerfect: false,
      landingZone: { row: 1, col: 1 },
      ...override,
    };
  }

  it("sets zoneLanded to zoneResult.landingZone when present (no control miss)", () => {
    const state = makeMatch(11111);
    const aimed = { row: 0 as const, col: 0 as const };
    const landing = { row: 0 as const, col: 0 as const }; // same cell — perfect aim

    const decision: AtBatDecision = {
      batterApproach: "contact",
      pitcherAimedZone: aimed,
      batterAimedZone: { row: 0 as const, col: 1 as const },
      zoneResult: fakeZoneResult({ landingZone: landing }),
    };

    const next = simulateAtBat_Interactive(state, decision);
    const lastPlay = next.playByPlay[next.playByPlay.length - 1];

    expect(lastPlay.zoneAimed).toEqual(aimed);
    expect(lastPlay.zoneLanded).toEqual(landing);
  });

  it("sets zoneLanded to zoneResult.landingZone even when it differs from aimed (control miss)", () => {
    const state = makeMatch(22222);
    const aimed = { row: 0 as const, col: 0 as const };
    // Pitch misses aimed zone — lands one cell away
    const landing = { row: 0 as const, col: 1 as const };

    const decision: AtBatDecision = {
      batterApproach: "power",
      pitcherAimedZone: aimed,
      batterAimedZone: { row: 0 as const, col: 0 as const },
      zoneResult: fakeZoneResult({ landingZone: landing }),
    };

    const next = simulateAtBat_Interactive(state, decision);
    const lastPlay = next.playByPlay[next.playByPlay.length - 1];

    // zoneLanded must be actual landing, not pitcherAimedZone
    expect(lastPlay.zoneAimed).toEqual(aimed);
    expect(lastPlay.zoneLanded).toEqual(landing);
    expect(lastPlay.zoneLanded).not.toEqual(lastPlay.zoneAimed);
  });

  it("falls back to pitcherAimedZone when zoneResult is absent (auto-sim path)", () => {
    const state = makeMatch(33333);
    const aimed = { row: 2 as const, col: 2 as const };

    const decision: AtBatDecision = {
      pitchStrategy: "finesse",
      pitcherAimedZone: aimed,
      // No zoneResult — auto-sim (opponent's half-inning)
    };

    const next = simulateAtBat_Interactive(state, decision);
    const lastPlay = next.playByPlay[next.playByPlay.length - 1];

    expect(lastPlay.zoneAimed).toEqual(aimed);
    expect(lastPlay.zoneLanded).toEqual(aimed);
  });

  it("leaves both zoneAimed and zoneLanded undefined when no zone data at all", () => {
    const state = makeMatch(44444);

    const decision: AtBatDecision = {
      batterApproach: "contact",
      // No zone data at all
    };

    const next = simulateAtBat_Interactive(state, decision);
    const lastPlay = next.playByPlay[next.playByPlay.length - 1];

    expect(lastPlay.zoneAimed).toBeUndefined();
    expect(lastPlay.zoneLanded).toBeUndefined();
  });

  it("zoneBatterAimed is recorded independently of zoneLanded", () => {
    const state = makeMatch(55555);
    const aimed    = { row: 1 as const, col: 0 as const };
    const landing  = { row: 1 as const, col: 1 as const }; // control miss
    const battery  = { row: 0 as const, col: 2 as const }; // batter was looking elsewhere

    const decision: AtBatDecision = {
      batterApproach: "patient",
      pitcherAimedZone: aimed,
      batterAimedZone: battery,
      zoneResult: fakeZoneResult({ landingZone: landing }),
    };

    const next = simulateAtBat_Interactive(state, decision);
    const lastPlay = next.playByPlay[next.playByPlay.length - 1];

    expect(lastPlay.zoneAimed).toEqual(aimed);
    expect(lastPlay.zoneLanded).toEqual(landing);
    expect(lastPlay.zoneBatterAimed).toEqual(battery);

    // All three are distinct
    expect(lastPlay.zoneLanded).not.toEqual(lastPlay.zoneAimed);
    expect(lastPlay.zoneBatterAimed).not.toEqual(lastPlay.zoneLanded);
  });
});
