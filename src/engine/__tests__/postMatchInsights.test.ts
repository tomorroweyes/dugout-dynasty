import { describe, expect, it } from "vitest";
import type { MatchResult, PlayByPlayEvent } from "@/types/game";
import { generatePostMatchInsights } from "../postMatchInsights";

function makeMatch(overrides: Partial<MatchResult>): MatchResult {
  return {
    myRuns: 0,
    opponentRuns: 0,
    isWin: false,
    cashEarned: 250,
    totalInnings: 9,
    playByPlay: [],
    ...overrides,
  };
}

function makeEvent(event: Partial<PlayByPlayEvent>): PlayByPlayEvent {
  return {
    inning: 1,
    isTop: false,
    batter: "Test Batter",
    pitcher: "Test Pitcher",
    outcome: "single",
    outs: 0,
    rbi: 0,
    ...event,
  };
}

describe("postMatchInsights", () => {
  it("returns fallback insight when play-by-play is empty", () => {
    const insights = generatePostMatchInsights(
      makeMatch({ playByPlay: [], isWin: false }),
    );

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].trigger).toContain("turning point");
  });

  it("extracts high-impact scoring insight in close late game", () => {
    const playByPlay = [
      makeEvent({ inning: 8, isTop: false, outcome: "homerun", rbi: 2 }),
      makeEvent({ inning: 9, isTop: true, outcome: "strikeout", outs: 2 }),
    ];

    const insights = generatePostMatchInsights(
      makeMatch({
        myRuns: 2,
        opponentRuns: 0,
        isWin: true,
        playByPlay,
      }),
    );

    expect(insights.some((insight) => insight.triggerType === "scoring_swing")).toBe(true);
  });

  it("captures repeated approach adaptation signal", () => {
    const playByPlay = [
      makeEvent({ inning: 6, batterApproach: "power", outcome: "strikeout" }),
      makeEvent({ inning: 6, batterApproach: "power", outcome: "flyout" }),
      makeEvent({ inning: 6, batterApproach: "power", outcome: "lineout" }),
    ];

    const insights = generatePostMatchInsights(
      makeMatch({
        myRuns: 0,
        opponentRuns: 1,
        isWin: false,
        playByPlay,
      }),
    );

    expect(
      insights.some((insight) => insight.triggerType === "repeated_approach"),
    ).toBe(true);
  });

  it("captures repeated strategy adaptation signal", () => {
    const playByPlay = [
      makeEvent({ inning: 7, isTop: true, pitchStrategy: "paint", outcome: "walk" }),
      makeEvent({ inning: 7, isTop: true, pitchStrategy: "paint", outcome: "single", rbi: 1 }),
      makeEvent({ inning: 7, isTop: true, pitchStrategy: "paint", outcome: "double", rbi: 1 }),
    ];

    const insights = generatePostMatchInsights(
      makeMatch({
        myRuns: 0,
        opponentRuns: 2,
        isWin: false,
        playByPlay,
      }),
    );

    expect(
      insights.some((insight) => insight.triggerType === "repeated_strategy"),
    ).toBe(true);
  });

  it("includes ability timing insight when ability flags are present", () => {
    const playByPlay = [
      makeEvent({
        inning: 5,
        batterAbilityUsed: true,
        outcome: "double",
        rbi: 1,
      }),
    ];

    const insights = generatePostMatchInsights(
      makeMatch({
        myRuns: 1,
        opponentRuns: 0,
        isWin: true,
        playByPlay,
      }),
    );

    expect(insights.some((insight) => insight.triggerType === "ability_timing")).toBe(true);
  });

  it("deduplicates duplicate trigger types and caps at 3 cards", () => {
    const playByPlay = [
      makeEvent({ inning: 8, isTop: false, outcome: "single", rbi: 1 }),
      makeEvent({ inning: 8, isTop: false, outcome: "double", rbi: 1 }),
      makeEvent({ inning: 8, isTop: false, outcome: "homerun", rbi: 2 }),
      makeEvent({ inning: 9, isTop: false, outcome: "triple", rbi: 1 }),
    ];

    const insights = generatePostMatchInsights(
      makeMatch({
        myRuns: 5,
        opponentRuns: 0,
        isWin: true,
        playByPlay,
      }),
    );

    expect(insights.length).toBeLessThanOrEqual(3);
    const scoringCount = insights.filter((insight) => insight.triggerType === "scoring_swing").length;
    expect(scoringCount).toBeLessThanOrEqual(1);
  });
});
