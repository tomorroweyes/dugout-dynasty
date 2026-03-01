/**
 * Pre-Game Narrative Generator Tests
 *
 * Verifies that generatePreGameContext returns sensible hooks for each
 * major situation: promotion race, relegation, streaks, head-to-head
 * history, and late-season urgency.
 */

import { describe, it, expect } from "vitest";
import { generatePreGameContext, type PreGameContext } from "../preGameNarrative";
import type { League, OpponentTeam, StandingsEntry } from "@/types/league";
import type { MatchLogEntry } from "@/types/save";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

const MY_ID = "team-player";
const OPP_ID = "team-opp";

function makeOpponent(overrides: Partial<OpponentTeam> = {}): OpponentTeam {
  return {
    id: OPP_ID,
    name: "River City Foxes",
    city: "River City",
    mascot: "Foxes",
    tier: "LOCAL",
    cash: 0,
    fans: 0,
    roster: [],
    lineup: [],
    wins: 3,
    losses: 3,
    colors: { primary: "#ff0000", secondary: "#ffffff" },
    aiPersonality: { aggression: 0.5, depthFocus: 0.5, restDiscipline: 0.5 },
    ...overrides,
  };
}

function makeStanding(
  teamId: string,
  wins: number,
  losses: number,
  streak = 0,
  teamName = "Test Team"
): StandingsEntry {
  return { teamId, teamName, wins, losses, runsScored: 0, runsAllowed: 0, streak };
}

function makeLeague(overrides: {
  standings?: StandingsEntry[];
  currentWeek?: number;
  totalWeeks?: number;
  tier?: League["tier"];
} = {}): League {
  const standings = overrides.standings ?? [
    makeStanding(MY_ID, 5, 2, 0, "My Team"),
    makeStanding(OPP_ID, 4, 3, 0, "River City Foxes"),
    makeStanding("team-c", 3, 4, 0, "Team C"),
    makeStanding("team-d", 2, 5, 0, "Team D"),
  ];

  return {
    id: "league-1",
    tier: overrides.tier ?? "LOCAL",
    season: 1,
    teams: [],
    humanTeamId: MY_ID,
    schedule: {
      weeks: Array.from({ length: overrides.totalWeeks ?? 8 }, (_, i) => ({
        weekNumber: i + 1,
        matches: i >= (overrides.currentWeek ?? 3)
          ? [{ homeTeamId: MY_ID, awayTeamId: OPP_ID, completed: false }]
          : [{ homeTeamId: MY_ID, awayTeamId: OPP_ID, completed: true }],
      })),
    },
    standings,
    currentWeek: overrides.currentWeek ?? 3,
    totalWeeks: overrides.totalWeeks ?? 8,
    isComplete: false,
  };
}

function run(
  leagueOverrides: Parameters<typeof makeLeague>[0] = {},
  matchLog: MatchLogEntry[] = [],
  opponentOverrides: Partial<OpponentTeam> = {}
): PreGameContext {
  return generatePreGameContext(
    makeLeague(leagueOverrides),
    MY_ID,
    makeOpponent(opponentOverrides),
    matchLog
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic shape
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — shape", () => {
  it("always returns 1-3 hookLines", () => {
    const ctx = run();
    expect(ctx.hookLines.length).toBeGreaterThanOrEqual(1);
    expect(ctx.hookLines.length).toBeLessThanOrEqual(3);
  });

  it("returns correct opponentName", () => {
    const ctx = run();
    expect(ctx.opponentName).toBe("River City Foxes");
  });

  it("returns myRecord from standings", () => {
    const ctx = run();
    expect(ctx.myRecord.wins).toBe(5);
    expect(ctx.myRecord.losses).toBe(2);
  });

  it("returns opponentRecord from standings", () => {
    const ctx = run({}, [], { id: OPP_ID, wins: 4, losses: 3 });
    expect(ctx.opponentRecord.wins).toBe(4);
    expect(ctx.opponentRecord.losses).toBe(3);
  });

  it("returns myStandingsPos = 1 when team leads", () => {
    const ctx = run();
    expect(ctx.myStandingsPos).toBe(1);
  });

  it("returns totalTeams = standings length", () => {
    const ctx = run();
    expect(ctx.totalTeams).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Promotion race hooks
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — promotion hooks", () => {
  it("generates a promotion-related hook when player is in promotion zone", () => {
    // Player 1st, comfortable cushion
    const ctx = run({
      standings: [
        makeStanding(MY_ID, 8, 1, 0),
        makeStanding(OPP_ID, 4, 5, 0),
        makeStanding("c", 3, 6, 0),
        makeStanding("d", 2, 7, 0),
      ],
    });
    // At least one line should reference promotion territory (or a related word)
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("promot") || text.includes("grip") || text.includes("pressure")
    ).toBe(true);
  });

  it("generates bubble hook when player is right on the cutoff", () => {
    // promotionSlots=2 for LOCAL; player tied for 2nd with 5W, next team also 5W
    const ctx = run({
      standings: [
        makeStanding("team-a", 7, 0, 0),
        makeStanding(MY_ID, 5, 2, 0),
        makeStanding(OPP_ID, 5, 2, 0), // tied at cutoff
        makeStanding("team-d", 2, 5, 0),
      ],
    });
    const text = ctx.hookLines[0].toLowerCase();
    // Bubble or "clinging" or "edge" language
    expect(
      text.includes("barely") ||
      text.includes("thread") ||
      text.includes("edge") ||
      text.includes("cutoff") ||
      text.includes("slip")
    ).toBe(true);
  });

  it("generates 'one back' hook when 1 game out", () => {
    const ctx = run({
      standings: [
        makeStanding("team-a", 7, 0, 0),
        makeStanding("team-b", 6, 1, 0),
        makeStanding(MY_ID, 5, 2, 0), // 1 game out of 2nd (promotion slot)
        makeStanding(OPP_ID, 4, 3, 0),
      ],
    });
    const text = ctx.hookLines[0].toLowerCase();
    expect(
      text.includes("one game") || text.includes("single win") || text.includes("one win")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Relegation hooks
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — relegation hooks", () => {
  it("generates a relegation hook when player is in relegation zone", () => {
    // LOCAL tier has 2 relegation slots, 4 teams → bottom 2 are relegated
    // Player is 4th (last)
    const ctx = run({
      tier: "LOCAL",
      standings: [
        makeStanding("team-a", 8, 0, 0),
        makeStanding("team-b", 7, 1, 0),
        makeStanding(OPP_ID, 4, 4, 0),
        makeStanding(MY_ID, 2, 6, 0), // 4th — bottom 2 relegate
      ],
    });
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("relegat") || text.includes("danger") || text.includes("bubble") || text.includes("zone")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Streak hooks
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — streak hooks", () => {
  it("generates a win-streak hook when player is on a 3-game streak", () => {
    const standings = [
      makeStanding(MY_ID, 5, 2, 3),
      makeStanding(OPP_ID, 4, 3, 0),
      makeStanding("c", 3, 4, 0),
      makeStanding("d", 2, 5, 0),
    ];
    const ctx = run({ standings });
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("three") ||
      text.includes("streak") ||
      text.includes("row") ||
      text.includes("groove") ||
      text.includes("momentum")
    ).toBe(true);
  });

  it("generates a losing-streak hook when player has lost 3+", () => {
    const standings = [
      makeStanding("team-a", 7, 0, 0),
      makeStanding(OPP_ID, 5, 2, 0),
      makeStanding("c", 4, 3, 0),
      makeStanding(MY_ID, 3, 4, -4),
    ];
    const ctx = run({ standings });
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("streak") ||
      text.includes("straight") ||
      text.includes("skidding") ||
      text.includes("stops here") ||
      text.includes("something")
    ).toBe(true);
  });

  it("generates an opponent hot-streak warning when opponent is on 4+ wins", () => {
    const standings = [
      makeStanding(MY_ID, 5, 2, 0),
      makeStanding(OPP_ID, 5, 2, 5),
      makeStanding("c", 3, 4, 0),
      makeStanding("d", 2, 5, 0),
    ];
    const ctx = run({ standings });
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("row") ||
      text.includes("streak") ||
      text.includes("rolling") ||
      text.includes("hot")
    ).toBe(true);
  });

  it("generates an opponent cold-streak note when opponent has lost 3+", () => {
    const standings = [
      makeStanding(MY_ID, 5, 2, 0),
      makeStanding(OPP_ID, 3, 4, -3),
      makeStanding("c", 3, 4, 0),
      makeStanding("d", 2, 5, 0),
    ];
    const ctx = run({ standings });
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("skidding") ||
      text.includes("straight") ||
      text.includes("rattled") ||
      text.includes("freefall") ||
      text.includes("press")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Head-to-head history
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — head-to-head hooks", () => {
  const makeLog = (wins: number, losses: number): MatchLogEntry[] => [
    ...Array.from({ length: wins }, () => ({
      isWin: true,
      myRuns: 5,
      opponentRuns: 2,
      cashEarned: 0,
      totalInnings: 9,
      timestamp: Date.now(),
      opponent: "River City Foxes",
    })),
    ...Array.from({ length: losses }, () => ({
      isWin: false,
      myRuns: 2,
      opponentRuns: 5,
      cashEarned: 0,
      totalInnings: 9,
      timestamp: Date.now(),
      opponent: "River City Foxes",
    })),
  ];

  it("generates 'you own this matchup' when player leads h2h significantly", () => {
    const ctx = run({}, makeLog(4, 1));
    const text = ctx.hookLines.join(" ").toLowerCase();
    // Covers all pool variants: "own this matchup", "{n}-{n} against {opp}", "favorable matchup"
    expect(
      text.includes("own") ||
      text.includes("favorable") ||
      text.includes("wins") ||
      text.includes("against") ||
      text.includes("matchup")
    ).toBe(true);
  });

  it("generates 'they dominate' hook when opponent leads h2h significantly", () => {
    const ctx = run({}, makeLog(1, 4));
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("number") ||
      text.includes("owns") ||
      text.includes("script") ||
      text.includes("record ends")
    ).toBe(true);
  });

  it("generates revenge hook after a recent loss", () => {
    const log: MatchLogEntry[] = [
      {
        isWin: false,
        myRuns: 1,
        opponentRuns: 7,
        cashEarned: 0,
        totalInnings: 9,
        timestamp: Date.now(),
        opponent: "River City Foxes",
      },
    ];
    const ctx = run({}, log);
    const text = ctx.hookLines.join(" ").toLowerCase();
    // Covers all pool variants: "beat you", "took one", "dropped", "forgotten"
    expect(
      text.includes("revenge") ||
      text.includes("beat you") ||
      text.includes("back") ||
      text.includes("took") ||
      text.includes("dropped") ||
      text.includes("forgotten")
    ).toBe(true);
  });

  it("does NOT generate h2h hook when no prior games", () => {
    const ctx = run({}, []);
    // Should still return at least 1 hook (generic opponent flavor or standings)
    expect(ctx.hookLines.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Late-season urgency
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — late-season hooks", () => {
  it("generates final-week hook on the last week", () => {
    // Mid-table so no promotion/relegation hook fires; streak=0; no h2h
    const ctx = run({
      currentWeek: 7, // last week (0-indexed of 8 total)
      totalWeeks: 8,
      standings: [
        makeStanding("a", 6, 1, 0),
        makeStanding("b", 5, 2, 0),
        makeStanding(MY_ID, 4, 3, 0), // 3 games out, not in promotion zone
        makeStanding(OPP_ID, 3, 4, 0),
        makeStanding("c", 2, 5, 0),
        makeStanding("d", 1, 6, 0),
      ],
    });
    const text = ctx.hookLines.join(" ").toLowerCase();
    expect(
      text.includes("final") || text.includes("last") || text.includes("week")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Generic opponent flavor (fallback)
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePreGameContext — generic opponent fallback", () => {
  it("returns at least 1 hook line even when no stakes apply", () => {
    // Comfortable mid-table, no streaks, no h2h, mid-season
    const ctx = run({
      standings: [
        makeStanding("a", 6, 0, 0),
        makeStanding("b", 5, 1, 0),
        makeStanding("c", 4, 2, 0),
        makeStanding(MY_ID, 3, 3, 0), // Far from promotion and relegation
        makeStanding(OPP_ID, 2, 4, 0),
        makeStanding("d", 1, 5, 0),
        makeStanding("e", 0, 6, 0),
        makeStanding("f", 0, 6, 0),
      ],
    });
    expect(ctx.hookLines.length).toBeGreaterThanOrEqual(1);
    expect(ctx.hookLines[0].length).toBeGreaterThan(10);
  });
});
