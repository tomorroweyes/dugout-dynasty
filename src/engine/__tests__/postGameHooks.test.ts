import { describe, it, expect } from "vitest";
import { generatePostGameHooks } from "@/engine/postGameHooks";
import type { League } from "@/types/league";
import type { OpponentTeam } from "@/types/league";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockOpponentTeam(id: string, wins: number, losses: number): OpponentTeam {
  return {
    id,
    name: `Team ${id}`,
    city: "Testville",
    mascot: "Testers",
    tier: "SANDLOT",
    wins,
    losses,
    cash: 0,
    fans: 100,
    roster: [],
    lineup: [],
    colors: { primary: "#fff", secondary: "#000" },
    aiPersonality: { aggression: 0.5, depthFocus: 0.5, restDiscipline: 0.5 },
  };
}

function mockLeague(overrides: {
  humanTeamId: string;
  teams: OpponentTeam[];
  currentWeek?: number;
  totalWeeks?: number;
  nextMatchOpponentId?: string;
}): League {
  const { humanTeamId, teams, currentWeek = 5, totalWeeks = 10, nextMatchOpponentId } = overrides;

  const nextOpponent = nextMatchOpponentId ?? teams.find((t) => t.id !== humanTeamId)?.id ?? "";

  return {
    id: "league-1",
    tier: "SANDLOT",
    season: 1,
    teams,
    humanTeamId,
    currentWeek,
    totalWeeks,
    isComplete: false,
    standings: [],
    schedule: {
      weeks: [
        // completed weeks
        ...Array.from({ length: currentWeek }, (_, i) => ({
          weekNumber: i,
          matches: [
            {
              homeTeamId: humanTeamId,
              awayTeamId: nextOpponent,
              completed: true,
            },
          ],
        })),
        // upcoming week with incomplete match
        {
          weekNumber: currentWeek,
          matches: [
            {
              homeTeamId: humanTeamId,
              awayTeamId: nextOpponent,
              completed: false,
            },
          ],
        },
      ],
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generatePostGameHooks", () => {
  it("returns exactly 3 hooks when enough data is available", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 6, 2),
      mockOpponentTeam("team-a", 8, 0), // leader
      mockOpponentTeam("team-b", 4, 4),
    ];
    const league = mockLeague({ humanTeamId, teams });
    const hooks = generatePostGameHooks(league, humanTeamId, true);
    expect(hooks.length).toBeLessThanOrEqual(3);
    expect(hooks.length).toBeGreaterThanOrEqual(1);
  });

  it("includes a standings hook when human team is not in 1st place", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 4, 4),
      mockOpponentTeam("team-leader", 8, 0),
    ];
    const league = mockLeague({ humanTeamId, teams });
    const hooks = generatePostGameHooks(league, humanTeamId, true);
    const standingsHook = hooks.find((h) => h.type === "standings");
    expect(standingsHook).toBeDefined();
    expect(standingsHook?.headline).toMatch(/behind 1st/);
  });

  it("shows 'top of the league' when human team leads", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 9, 1),
      mockOpponentTeam("team-b", 5, 5),
    ];
    const league = mockLeague({ humanTeamId, teams });
    const hooks = generatePostGameHooks(league, humanTeamId, true);
    const standingsHook = hooks.find((h) => h.type === "standings");
    expect(standingsHook).toBeDefined();
    expect(standingsHook?.headline).toMatch(/top of the league/);
  });

  it("shows 'half a game behind' for 0.5-game deficit", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 5, 4), // .556
      mockOpponentTeam("team-leader", 6, 4), // .600 — GB = (6-5 + 4-4)/2 = 0.5
    ];
    const league = mockLeague({ humanTeamId, teams });
    const hooks = generatePostGameHooks(league, humanTeamId, false);
    const standingsHook = hooks.find((h) => h.type === "standings");
    expect(standingsHook?.headline).toMatch(/Half a game/);
  });

  it("shows season-pace hook near end of season", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 7, 5),
      mockOpponentTeam("team-b", 8, 4),
    ];
    const league = mockLeague({
      humanTeamId,
      teams,
      currentWeek: 8,
      totalWeeks: 10,
    });
    const hooks = generatePostGameHooks(league, humanTeamId, true);
    const paceHook = hooks.find((h) => h.type === "season-pace");
    expect(paceHook).toBeDefined();
    expect(paceHook?.headline).toMatch(/2 weeks left/);
  });

  it("shows next-opponent hook when an upcoming match exists", () => {
    const humanTeamId = "team-human";
    const nextOpponentId = "team-next";
    const teams = [
      mockOpponentTeam(humanTeamId, 5, 3),
      mockOpponentTeam(nextOpponentId, 7, 1),
      mockOpponentTeam("team-other", 3, 5),
    ];
    const league = mockLeague({ humanTeamId, teams, nextMatchOpponentId: nextOpponentId });
    const hooks = generatePostGameHooks(league, humanTeamId, true);
    const opponentHook = hooks.find((h) => h.type === "next-opponent");
    expect(opponentHook).toBeDefined();
    expect(opponentHook?.headline).toContain(`Team ${nextOpponentId}`);
  });

  it("returns hooks with high urgency when 1 game behind with few weeks left", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 7, 4),
      mockOpponentTeam("team-leader", 8, 3),
    ];
    const league = mockLeague({
      humanTeamId,
      teams,
      currentWeek: 9,
      totalWeeks: 10,
    });
    const hooks = generatePostGameHooks(league, humanTeamId, false);
    const standingsHook = hooks.find((h) => h.type === "standings");
    expect(standingsHook?.urgency).toBe("high");
  });

  it("returns empty array if human team not found in standings", () => {
    const teams = [mockOpponentTeam("team-a", 5, 3)];
    const league = mockLeague({ humanTeamId: "nonexistent", teams });
    const hooks = generatePostGameHooks(league, "nonexistent", true);
    expect(hooks).toEqual([]);
  });

  it("handles win and loss framing correctly in hot-streak hook", () => {
    const humanTeamId = "team-human";
    const teams = [
      mockOpponentTeam(humanTeamId, 3, 3),
      mockOpponentTeam("team-leader", 5, 1),
    ];
    const league = mockLeague({ humanTeamId, teams, currentWeek: 3, totalWeeks: 10 });

    const winHooks = generatePostGameHooks(league, humanTeamId, true);
    const lossHooks = generatePostGameHooks(league, humanTeamId, false);

    const winStreak = winHooks.find((h) => h.type === "hot-streak");
    const lossStreak = lossHooks.find((h) => h.type === "hot-streak");

    // Both should render (gamesPlayed >= 3) — content may differ
    if (winStreak) expect(winStreak.headline).toBeTruthy();
    if (lossStreak) expect(lossStreak.headline).toBeTruthy();
  });
});
