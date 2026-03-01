/**
 * Pre-Game Narrative Generator
 *
 * Produces 1-3 contextual "stake" lines surfaced on the pre-game card
 * before each interactive match. Lines cover standings position, streaks,
 * opponent reputation, prior head-to-head history, and late-season urgency.
 *
 * All strings live in PRE_GAME_HOOKS_POOLS below — never hardcode prose.
 * Logic only touches game-state to select which pool to draw from.
 */

import type { League, OpponentTeam } from "@/types/league";
import type { MatchLogEntry } from "@/types/save";
import { GAME_CONSTANTS } from "@/engine/constants";

// ─────────────────────────────────────────────────────────────────────────────
// String pools — all user-facing text lives here
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokens:
 *   {opp}      — opponent display name (e.g. "River City Foxes")
 *   {n}        — a numeric quantity (games back, streak length, score, etc.)
 *   {myW}      — your team wins
 *   {myL}      — your team losses
 *   {oppW}     — opponent wins
 *   {oppL}     — opponent losses
 *   {weeksLeft} — weeks remaining in the season
 */

const PRE_GAME_HOOKS = {
  // You're in a promotion spot — comfortably
  promotionSafe: [
    "You're in promotion territory. A win here locks in the lead.",
    "Sitting in a promotion spot. Keep building — one game at a time.",
    "A win today and the pressure shifts to everyone chasing you.",
  ],

  // You're in a promotion spot — right on the bubble (≤1 game ahead)
  promotionBubble: [
    "You're in a promotion spot — barely. One slip and it's gone.",
    "Clinging to the cutoff by a thread. This game matters.",
    "On the edge of promotion. Win and breathe easy. Lose and things get complicated.",
  ],

  // 1 game out of promotion
  oneBack: [
    "One game out of a promotion spot. Win today and you're right back in it.",
    "A single win separates you from the top. Go get it.",
    "They're one game ahead. Not for long.",
  ],

  // 2-4 games out of promotion
  inTheHunt: [
    "{n} games back from promotion. Still alive — but this one counts.",
    "You're {n} games out. Every win from here is borrowed time.",
    "Trailing by {n}. Today's a must-win if you're serious about moving up.",
  ],

  // Relegated or on the relegation bubble
  relegationZone: [
    "You're in the relegation zone. {n} games from safety — get one here.",
    "Danger zone. A loss today digs the hole deeper.",
    "On the bubble for relegation. Win or watch your season unravel.",
  ],

  // Your win streak (3)
  myStreak3: [
    "Three straight wins. Keep the energy — don't let them slow you down.",
    "You've found a groove. Protect it.",
    "Three in a row builds something. Four builds momentum.",
  ],

  // Your win streak (4+)
  myStreak4Plus: [
    "{n} in a row. Momentum is real — ride it.",
    "You've won {n} straight. The league is starting to notice.",
    "{n}-game win streak on the line. Go protect it.",
  ],

  // Your losing streak (3+)
  myLoseStreak: [
    "You've dropped {n} straight. Something has to give today.",
    "{n} losses in a row. It stops here.",
    "Skidding. {n}-game losing streak. This is the moment to turn it around.",
  ],

  // Opponent on a hot streak (4+)
  oppHotStreak: [
    "{opp} has won {n} in a row. They're rolling — come ready.",
    "You're facing a hot team. {opp} has won {n} straight.",
    "{opp} is on fire — {n}-game win streak. Take them seriously.",
  ],

  // Opponent cold streak (3+ losses)
  oppColdStreak: [
    "{opp} has lost {n} straight. Their confidence is rattled — press the advantage.",
    "Catch them now. {opp} is skidding at {n} straight losses.",
    "{opp} is in freefall. Make it {n}+1.",
  ],

  // Prior loss to this opponent (revenge game)
  priorLoss: [
    "They beat you last time — {n}-{myRuns}. Revenge opportunity.",
    "They took one from you. Get it back today.",
    "Last time out you dropped {n}-{myRuns}. They haven't forgotten. Neither should you.",
  ],

  // Prior loss + dominated matchup historically
  dominated: [
    "This team owns you — {oppW} wins against your {myW} in head-to-head. Time to flip the script.",
    "They've had your number. Change that today.",
    "You're {myW}-{oppW} against {opp}. That record ends today or gets worse.",
  ],

  // You dominate this matchup
  youOwn: [
    "You own this matchup — {myW} wins to their {oppW}. Keep it that way.",
    "{myW}-{oppW} against {opp}. Make it {nextW}.",
    "This is a favorable matchup. Show them why.",
  ],

  // Late season urgency (≤2 weeks left)
  lateSeasonFinal: [
    "Final week of the season. This is what it all comes down to.",
    "Last chance to make your mark. One week left — make it count.",
  ],

  lateSeasonTwo: [
    "Two weeks left. Every game from here decides who promotes and who doesn't.",
    "The stretch run is here. No more safety net — two weeks to go.",
    "Playoffs are coming into focus. Two games left to shape where you land.",
  ],

  // Generic opponent flavor when nothing else fires
  opponentStrong: [
    "{opp} is {oppW}-{oppL} — one of the better teams in this league. Don't take them lightly.",
    "They're sitting at {oppW}-{oppL}. Come ready.",
  ],

  opponentStruggling: [
    "{opp} is struggling at {oppW}-{oppL}. Put them away.",
    "They're {oppW}-{oppL}. Make them feel it.",
  ],

  opponentEven: [
    "{opp} at {oppW}-{oppL}. Evenly matched on paper — this comes down to execution.",
    "A tight matchup. {opp} is {oppW}-{oppL}. Don't assume anything.",
  ],
} as const;

type HookKey = keyof typeof PRE_GAME_HOOKS;

function pick(key: HookKey): string {
  const pool = PRE_GAME_HOOKS[key] as readonly string[];
  return pool[Math.floor(Math.random() * pool.length)];
}

function fill(
  template: string,
  tokens: Record<string, string | number>
): string {
  return Object.entries(tokens).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface PreGameContext {
  /** Opponent display name — "City Mascot" */
  opponentName: string;
  /** Your team's current season record */
  myRecord: { wins: number; losses: number };
  /** Opponent's current season record */
  opponentRecord: { wins: number; losses: number };
  /**
   * 1-3 narrative lines surfaced as stakes hooks.
   * Ordered: highest drama / most actionable first.
   */
  hookLines: string[];
  /** Your current position in the standings (1 = first) */
  myStandingsPos: number;
  /** Total teams in the league */
  totalTeams: number;
  /** Games remaining in the season (including this one) */
  gamesRemaining: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate pre-game context hooks for the upcoming match.
 *
 * @param league - Current league state
 * @param myTeamId - Human player's team ID
 * @param opponent - The opponent team object
 * @param matchLog - Full match history (for head-to-head lookups)
 */
export function generatePreGameContext(
  league: League,
  myTeamId: string,
  opponent: OpponentTeam,
  matchLog: MatchLogEntry[]
): PreGameContext {
  const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[league.tier];
  const promotionSlots = tierConfig.promotionSlots;
  const relegationSlots = tierConfig.relegationSlots;

  const opponentName = `${opponent.city} ${opponent.mascot}`;

  // Standings — sort by wins desc, losses asc
  const sorted = [...league.standings].sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses
  );

  const myEntry = sorted.find((s) => s.teamId === myTeamId);
  const oppEntry = sorted.find((s) => s.teamId === opponent.id);

  const myRecord = { wins: myEntry?.wins ?? 0, losses: myEntry?.losses ?? 0 };
  const opponentRecord = {
    wins: oppEntry?.wins ?? 0,
    losses: oppEntry?.losses ?? 0,
  };

  const myPos = sorted.findIndex((s) => s.teamId === myTeamId) + 1; // 1-indexed
  const totalTeams = sorted.length;
  const myStreak = myEntry?.streak ?? 0;
  const oppStreak = oppEntry?.streak ?? 0;

  const weeksLeft = league.totalWeeks - league.currentWeek;
  // Count remaining unplayed home/away games for the human team
  const gamesRemaining = league.schedule.weeks
    .slice(league.currentWeek)
    .flatMap((w) => w.matches)
    .filter(
      (m) =>
        !m.completed &&
        (m.homeTeamId === myTeamId || m.awayTeamId === myTeamId)
    ).length;

  // ── Head-to-head history ───────────────────────────────────────────────────
  const h2h = matchLog.filter((e) => e.opponent === opponentName);
  const h2hWins = h2h.filter((e) => e.isWin).length;
  const h2hLosses = h2h.length - h2hWins;
  const lastH2H = h2h.length > 0 ? h2h[h2h.length - 1] : null;

  // ── Build hook lines, highest priority first ───────────────────────────────
  const lines: string[] = [];

  // 1. Standings / playoff context (highest stakes)
  if (promotionSlots > 0 && myPos <= promotionSlots) {
    // In a promotion spot
    const nextOut = sorted[promotionSlots]; // First team not in promotion
    const gamesAhead = nextOut ? myRecord.wins - nextOut.wins : myRecord.wins;
    if (gamesAhead <= 1) {
      lines.push(pick("promotionBubble"));
    } else {
      lines.push(pick("promotionSafe"));
    }
  } else if (promotionSlots > 0) {
    const cutoffTeam = sorted[promotionSlots - 1]; // Last team in promotion
    const gamesBack = cutoffTeam
      ? cutoffTeam.wins - myRecord.wins
      : 0;
    if (gamesBack === 1) {
      lines.push(pick("oneBack"));
    } else if (gamesBack <= 4) {
      lines.push(fill(pick("inTheHunt"), { n: gamesBack }));
    }
  }

  // Relegation threat
  if (relegationSlots > 0) {
    const safePos = totalTeams - relegationSlots; // Last safe position (1-indexed)
    if (myPos > safePos) {
      const safeTeam = sorted[safePos - 1];
      const gamesBack = safeTeam ? safeTeam.wins - myRecord.wins : 0;
      lines.push(fill(pick("relegationZone"), { n: Math.max(gamesBack, 1) }));
    }
  }

  // 2. Your streak context
  if (lines.length < 3 && myStreak >= 4) {
    lines.push(fill(pick("myStreak4Plus"), { n: myStreak }));
  } else if (lines.length < 3 && myStreak === 3) {
    lines.push(pick("myStreak3"));
  } else if (lines.length < 3 && myStreak <= -3) {
    lines.push(fill(pick("myLoseStreak"), { n: Math.abs(myStreak) }));
  }

  // 3. Opponent streak context
  if (lines.length < 3 && oppStreak >= 4) {
    lines.push(fill(pick("oppHotStreak"), { opp: opponentName, n: oppStreak }));
  } else if (lines.length < 3 && oppStreak <= -3) {
    lines.push(
      fill(pick("oppColdStreak"), { opp: opponentName, n: Math.abs(oppStreak) })
    );
  }

  // 4. Head-to-head history
  if (lines.length < 3 && h2h.length > 0) {
    if (h2hLosses > h2hWins + 1) {
      // They dominate the matchup
      lines.push(
        fill(pick("dominated"), {
          opp: opponentName,
          myW: h2hWins,
          oppW: h2hLosses,
        })
      );
    } else if (h2hWins > h2hLosses + 1) {
      // You dominate
      lines.push(
        fill(pick("youOwn"), {
          opp: opponentName,
          myW: h2hWins,
          oppW: h2hLosses,
          nextW: h2hWins + 1,
        })
      );
    } else if (lastH2H && !lastH2H.isWin) {
      // Recent loss — revenge framing
      lines.push(
        fill(pick("priorLoss"), {
          n: lastH2H.opponentRuns,
          myRuns: lastH2H.myRuns,
        })
      );
    }
  }

  // 5. Late-season urgency (filler if lines still sparse)
  if (lines.length < 2 && weeksLeft <= 1) {
    lines.push(pick("lateSeasonFinal"));
  } else if (lines.length < 2 && weeksLeft <= 2) {
    lines.push(pick("lateSeasonTwo"));
  }

  // 6. Generic opponent flavor — always fires if we still have < 1 line
  if (lines.length === 0) {
    const oppW = opponentRecord.wins;
    const oppL = opponentRecord.losses;
    const tokens = { opp: opponentName, oppW, oppL };
    if (oppW > oppL + 2) {
      lines.push(fill(pick("opponentStrong"), tokens));
    } else if (oppL > oppW + 2) {
      lines.push(fill(pick("opponentStruggling"), tokens));
    } else {
      lines.push(fill(pick("opponentEven"), tokens));
    }
  }

  return {
    opponentName,
    myRecord,
    opponentRecord,
    hookLines: lines.slice(0, 3),
    myStandingsPos: myPos,
    totalTeams,
    gamesRemaining,
  };
}
