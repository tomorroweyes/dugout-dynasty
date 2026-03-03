import type { League } from "@/types/league";
import { calculateStandings } from "@/engine/leagueGenerator";

export type PostGameHookType = "standings" | "season-pace" | "next-opponent" | "hot-streak";

export interface PostGameHook {
  type: PostGameHookType;
  icon: string;
  headline: string;
  detail: string;
  urgency: "high" | "medium" | "low";
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Generate 2–3 forward-looking hooks to display on the post-game screen.
 *
 * Uses `calculateStandings(league.teams)` so the standings reflect the
 * match that was JUST completed (applyInteractiveMatchResult updates
 * team.wins/losses before this is called).
 */
export function generatePostGameHooks(
  league: League,
  myTeamId: string,
  isWin: boolean
): PostGameHook[] {
  const hooks: PostGameHook[] = [];

  // Recalculate standings from teams array (reflects the just-completed match)
  const standings = calculateStandings(league.teams);
  const myPos = standings.findIndex((s) => s.teamId === myTeamId);
  const myStanding = standings[myPos];
  const leader = standings[0];

  if (!myStanding) return hooks;

  const weeksLeft = league.totalWeeks - league.currentWeek;
  const gamesPlayed = myStanding.wins + myStanding.losses;

  // ─── Hook 1: Standings position ──────────────────────────────────────────
  if (myPos === 0) {
    // Leading the league
    hooks.push({
      type: "standings",
      icon: "🏆",
      headline: `${myStanding.wins}-${myStanding.losses} — top of the league`,
      detail:
        weeksLeft > 0
          ? `${weeksLeft} week${weeksLeft !== 1 ? "s" : ""} left — keep the lead`
          : "Season complete — you finished on top",
      urgency: "high",
    });
  } else {
    const gamesBehind =
      (leader.wins - myStanding.wins + (myStanding.losses - leader.losses)) / 2;
    const canCatch = gamesBehind <= weeksLeft;

    hooks.push({
      type: "standings",
      icon: "📊",
      headline:
        gamesBehind === 0.5
          ? `Half a game behind 1st place`
          : `${gamesBehind} game${gamesBehind !== 1 ? "s" : ""} behind 1st`,
      detail: canCatch
        ? `${ordinalSuffix(myPos + 1)} place · ${weeksLeft} week${weeksLeft !== 1 ? "s" : ""} to close it out`
        : `${ordinalSuffix(myPos + 1)} place · finish strong for next season`,
      urgency: gamesBehind <= 2 ? "high" : "medium",
    });
  }

  // ─── Hook 2: Season momentum / pace ─────────────────────────────────────
  if (weeksLeft <= 3 && weeksLeft > 0) {
    hooks.push({
      type: "season-pace",
      icon: "⏰",
      headline: `${weeksLeft} week${weeksLeft !== 1 ? "s" : ""} left in the season`,
      detail: "Every game counts now — don't leave it to chance",
      urgency: "high",
    });
  } else if (gamesPlayed >= 3) {
    // Show win rate as momentum signal
    const winRate = Math.round((myStanding.wins / gamesPlayed) * 100);
    const isAbove500 = myStanding.wins > myStanding.losses;
    hooks.push({
      type: "hot-streak",
      icon: isAbove500 ? "🔥" : "💪",
      headline: isWin
        ? isAbove500
          ? `${winRate}% win rate — rolling`
          : "Win streak started — build on it"
        : isAbove500
          ? "Still above .500 — bounce back next game"
          : "Time to put a run together",
      detail: `${myStanding.wins}-${myStanding.losses} on the season`,
      urgency: isAbove500 ? "medium" : "high",
    });
  }

  // ─── Hook 3: Next opponent preview ───────────────────────────────────────
  let nextOpponentId: string | null = null;
  for (let w = league.currentWeek; w < league.schedule.weeks.length; w++) {
    const week = league.schedule.weeks[w];
    if (!week) break;
    const match = week.matches.find(
      (m) =>
        !m.completed &&
        (m.homeTeamId === myTeamId || m.awayTeamId === myTeamId)
    );
    if (match) {
      nextOpponentId =
        match.homeTeamId === myTeamId ? match.awayTeamId : match.homeTeamId;
      break;
    }
  }

  if (nextOpponentId) {
    const oppStanding = standings.find((s) => s.teamId === nextOpponentId);
    const oppTeam = league.teams.find((t) => t.id === nextOpponentId);
    if (oppStanding && oppTeam) {
      const oppPos = standings.findIndex((s) => s.teamId === nextOpponentId);
      const oppGames = oppStanding.wins + oppStanding.losses;
      const oppWinRate =
        oppGames > 0
          ? Math.round((oppStanding.wins / oppGames) * 100)
          : 0;
      const isTopOpponent = oppPos <= 1;
      hooks.push({
        type: "next-opponent",
        icon: "👀",
        headline: `Up next: ${oppTeam.name}`,
        detail: `${ordinalSuffix(oppPos + 1)} place · ${oppStanding.wins}-${oppStanding.losses}${oppGames > 0 ? ` · ${oppWinRate}% wins` : ""}`,
        urgency: isTopOpponent ? "high" : "medium",
      });
    }
  }

  return hooks.slice(0, 3);
}
