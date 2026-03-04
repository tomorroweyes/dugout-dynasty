import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "@/store/gameStore";
import type { Team, OpponentTeam, MatchResult } from "@/types/game";
import { generateStarterTeam } from "@/engine/playerGenerator";
import { SeededRandomProvider } from "@/engine/randomProvider";

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

/**
 * Test that interactive match results are applied as-is,
 * and NOT replaced with AI re-simulation scores.
 *
 * This is the critical bug from issue #57:
 * Player plays 15-13 game, but after clicking Continue,
 * the score is replaced with a different AI re-simulation (e.g., 40-2).
 */

function createTeamForTest(id: string, seed: number): Team {
  const roster = generateStarterTeam(new SeededRandomProvider(seed), "SANDLOT");
  return {
    id,
    cash: 5000,
    fans: 1,
    roster,
    lineup: roster.map((p) => p.id),
    wins: 0,
    losses: 0,
    colors: { primary: "#1E40AF", secondary: "#DBEAFE" },
  };
}

function createOpponentTeamForTest(id: string, seed: number): OpponentTeam {
  const roster = generateStarterTeam(new SeededRandomProvider(seed), "SANDLOT");
  return {
    id,
    name: "Opponent Team",
    roster,
    wins: 0,
    losses: 0,
  };
}

describe("Interactive match result application (Issue #57)", () => {
  beforeEach(() => {
    // Initialize store with fresh state
    useGameStore.getState().resetGame();
  });

  it("should preserve the actual interactive match score (15-13 stays 15-13)", () => {
    const store = useGameStore.getState();

    // Setup: Initialize game with human team in league
    const myTeam = createTeamForTest("human-team", 101);
    const opponentTeam = createOpponentTeamForTest("opp-team", 202);

    // Manually initialize minimal league state (normally done by initializeGame)
    store.initializeGame("human", "SANDLOT");

    // Get the updated state
    const { team: initTeam, league } = useGameStore.getState();
    if (!initTeam || !league) {
      throw new Error("Failed to initialize game");
    }

    // Construct a fake interactive match result with a specific score
    const pitcherId = initTeam.roster[9]?.id || initTeam.roster[0].id;
    const oppPitcherId = opponentTeam.roster[9]?.id || opponentTeam.roster[0].id;

    const fakeInteractiveResult: MatchResult = {
      myRuns: 15,
      opponentRuns: 13,
      isWin: true, // We won this game
      cashEarned: 500,
      totalInnings: 9,
      playByPlay: [
        // Minimal valid play-by-play
        {
          inning: 1,
          isTop: true,
          outcome: "single",
          batter: initTeam.roster[0].id,
          pitcher: oppPitcherId,
          rbi: 0,
          outs: 0,
          batterApproach: "power",
          pitchStrategy: "power",
          batterPower: 50,
          pitcherAim: "high",
          isContact: false,
          zonePlay: null,
        },
      ],
      boxScore: {
        myBatters: initTeam.roster.slice(0, 9).map((p) => ({
          playerId: p.id,
          atBats: 3,
          hits: 1,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbis: 1,
          strikeOuts: 1,
          walks: 0,
          runs: 2,
          position: p.position,
        })),
        myPitchers: [
          {
            playerId: pitcherId,
            position: "P",
            inningsPitched: 9,
            pitches: 120,
            strikes: 75,
            outs: 27,
            hits: 10,
            runs: 13,
            earnedRuns: 12,
            walks: 2,
            strikeOuts: 8,
            homeRuns: 1,
            fatigue: 0.9,
          },
        ],
        opponentBatters: opponentTeam.roster.slice(0, 9).map((p) => ({
          playerId: p.id,
          atBats: 3,
          hits: 1,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbis: 1,
          strikeOuts: 1,
          walks: 0,
          runs: 1,
          position: p.position,
        })),
        opponentPitchers: [
          {
            playerId: oppPitcherId,
            position: "P",
            inningsPitched: 9,
            pitches: 110,
            strikes: 70,
            outs: 27,
            hits: 12,
            runs: 15,
            earnedRuns: 14,
            walks: 3,
            strikeOuts: 7,
            homeRuns: 0,
            fatigue: 0.85,
          },
        ],
      },
      lootDrops: [],
    };

    // Apply the interactive result
    store.applyInteractiveMatchResult(
      fakeInteractiveResult,
      initTeam,
      opponentTeam,
      { win: 500, loss: 250 }
    );

    // Verify the score is preserved
    const { matchLog } = useGameStore.getState();
    expect(matchLog).toHaveLength(1);

    const recordedMatch = matchLog[0];
    expect(recordedMatch.myRuns).toBe(15);
    expect(recordedMatch.opponentRuns).toBe(13);
    expect(recordedMatch.isWin).toBe(true);
    expect(recordedMatch.cashEarned).toBe(500);
  });

  it("should handle a loss and preserve the losing score", () => {
    const store = useGameStore.getState();
    store.initializeGame("human", "SANDLOT");

    const { team: initTeam, league } = useGameStore.getState();
    if (!initTeam || !league) throw new Error("Failed to initialize game");

    const opponentTeam = createOpponentTeamForTest("opp-team", 202);

    const pitcherId = initTeam.roster[9]?.id || initTeam.roster[0].id;
    const oppPitcherId = opponentTeam.roster[9]?.id || opponentTeam.roster[0].id;

    // Create a loss result
    const lossResult: MatchResult = {
      myRuns: 2,
      opponentRuns: 8,
      isWin: false,
      cashEarned: 250,
      totalInnings: 9,
      playByPlay: [],
      boxScore: {
        myBatters: initTeam.roster.slice(0, 9).map((p) => ({
          playerId: p.id,
          atBats: 4,
          hits: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbis: 0,
          strikeOuts: 3,
          walks: 0,
          runs: 0,
          position: p.position,
        })),
        myPitchers: [
          {
            playerId: pitcherId,
            position: "P",
            inningsPitched: 9,
            pitches: 130,
            strikes: 80,
            outs: 27,
            hits: 10,
            runs: 8,
            earnedRuns: 8,
            walks: 2,
            strikeOuts: 10,
            homeRuns: 0,
            fatigue: 1.0,
          },
        ],
        opponentBatters: opponentTeam.roster.slice(0, 9).map((p) => ({
          playerId: p.id,
          atBats: 4,
          hits: 2,
          doubles: 0,
          triples: 0,
          homeRuns: 1,
          rbis: 3,
          strikeOuts: 1,
          walks: 0,
          runs: 2,
          position: p.position,
        })),
        opponentPitchers: [
          {
            playerId: oppPitcherId,
            position: "P",
            inningsPitched: 9,
            pitches: 100,
            strikes: 65,
            outs: 27,
            hits: 3,
            runs: 2,
            earnedRuns: 2,
            walks: 1,
            strikeOuts: 8,
            homeRuns: 0,
            fatigue: 0.6,
          },
        ],
      },
      lootDrops: [],
    };

    store.applyInteractiveMatchResult(
      lossResult,
      initTeam,
      opponentTeam,
      { win: 500, loss: 250 }
    );

    const { matchLog } = useGameStore.getState();
    expect(matchLog).toHaveLength(1);

    const recordedMatch = matchLog[0];
    expect(recordedMatch.myRuns).toBe(2);
    expect(recordedMatch.opponentRuns).toBe(8);
    expect(recordedMatch.isWin).toBe(false);
    expect(recordedMatch.cashEarned).toBe(250);
  });

  it("should update team win/loss record correctly", () => {
    const store = useGameStore.getState();
    store.initializeGame("human", "SANDLOT");

    const { team: initTeam, league } = useGameStore.getState();
    if (!initTeam || !league) throw new Error("Failed to initialize game");

    const opponentTeam = createOpponentTeamForTest("opp-team", 202);

    const pitcherId = initTeam.roster[9]?.id || initTeam.roster[0].id;
    const oppPitcherId = opponentTeam.roster[9]?.id || opponentTeam.roster[0].id;

    // Win
    const winResult: MatchResult = {
      myRuns: 5,
      opponentRuns: 3,
      isWin: true,
      cashEarned: 500,
      totalInnings: 9,
      playByPlay: [],
      boxScore: {
        myBatters: initTeam.roster.slice(0, 9).map((p) => ({
          playerId: p.id,
          atBats: 4,
          hits: 1,
          doubles: 0,
          triples: 0,
          homeRuns: 1,
          rbis: 2,
          strikeOuts: 2,
          walks: 0,
          runs: 1,
          position: p.position,
        })),
        myPitchers: [
          {
            playerId: pitcherId,
            position: "P",
            inningsPitched: 9,
            pitches: 110,
            strikes: 70,
            outs: 27,
            hits: 8,
            runs: 3,
            earnedRuns: 3,
            walks: 2,
            strikeOuts: 9,
            homeRuns: 0,
            fatigue: 0.7,
          },
        ],
        opponentBatters: opponentTeam.roster.slice(0, 9).map((p) => ({
          playerId: p.id,
          atBats: 4,
          hits: 1,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbis: 1,
          strikeOuts: 2,
          walks: 0,
          runs: 1,
          position: p.position,
        })),
        opponentPitchers: [
          {
            playerId: oppPitcherId,
            position: "P",
            inningsPitched: 9,
            pitches: 120,
            strikes: 75,
            outs: 27,
            hits: 10,
            runs: 5,
            earnedRuns: 5,
            walks: 1,
            strikeOuts: 8,
            homeRuns: 1,
            fatigue: 0.8,
          },
        ],
      },
      lootDrops: [],
    };

    store.applyInteractiveMatchResult(
      winResult,
      initTeam,
      opponentTeam,
      { win: 500, loss: 250 }
    );

    const { team: updatedTeam } = useGameStore.getState();
    expect(updatedTeam!.wins).toBe(initTeam.wins + 1);
    expect(updatedTeam!.losses).toBe(initTeam.losses);
  });
});
