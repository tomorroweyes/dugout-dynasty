/**
 * Season & Career Stat Accumulation
 *
 * Accumulates per-player batting/pitching stats from BoxScore data
 * after each match. Season stats reset on new season; career stats persist.
 */

import type {
  Player,
  PlayerBoxScore,
  PitcherBoxScore,
  BoxScore,
  BatterSeasonStats,
  PitcherSeasonStats,
} from "@/types/game";
import { isBatter, isPitcher } from "@/types/game";

const EMPTY_BATTER_STATS: BatterSeasonStats = {
  gamesPlayed: 0,
  atBats: 0,
  hits: 0,
  runs: 0,
  rbis: 0,
  strikeouts: 0,
  walks: 0,
  doubles: 0,
  triples: 0,
  homeRuns: 0,
};

const EMPTY_PITCHER_STATS: PitcherSeasonStats = {
  gamesPlayed: 0,
  inningsPitched: 0,
  hitsAllowed: 0,
  runsAllowed: 0,
  strikeouts: 0,
  walks: 0,
  homeRunsAllowed: 0,
};

function initializeIfNeeded(player: Player): Player {
  if (player.seasonStats && player.careerStats) return player;
  const empty = isBatter(player) ? { ...EMPTY_BATTER_STATS } : { ...EMPTY_PITCHER_STATS };
  return {
    ...player,
    seasonStats: player.seasonStats ?? { ...empty },
    careerStats: player.careerStats ?? { ...empty },
  };
}

function accumulateBatter(player: Player, box: PlayerBoxScore): Player {
  const season = player.seasonStats as BatterSeasonStats;
  const career = player.careerStats as BatterSeasonStats;

  const add = (s: BatterSeasonStats): BatterSeasonStats => ({
    gamesPlayed: s.gamesPlayed + 1,
    atBats: s.atBats + box.atBats,
    hits: s.hits + box.hits,
    runs: s.runs + box.runs,
    rbis: s.rbis + box.rbis,
    strikeouts: s.strikeouts + box.strikeouts,
    walks: s.walks + box.walks,
    doubles: s.doubles + (box.doubles ?? 0),
    triples: s.triples + (box.triples ?? 0),
    homeRuns: s.homeRuns + (box.homeRuns ?? 0),
  });

  return { ...player, seasonStats: add(season), careerStats: add(career) };
}

function accumulatePitcher(player: Player, box: PitcherBoxScore): Player {
  const season = player.seasonStats as PitcherSeasonStats;
  const career = player.careerStats as PitcherSeasonStats;

  const add = (s: PitcherSeasonStats): PitcherSeasonStats => ({
    gamesPlayed: s.gamesPlayed + 1,
    inningsPitched: s.inningsPitched + box.inningsPitched,
    hitsAllowed: s.hitsAllowed + box.hitsAllowed,
    runsAllowed: s.runsAllowed + box.runsAllowed,
    strikeouts: s.strikeouts + box.strikeouts,
    walks: s.walks + box.walks,
    homeRunsAllowed: s.homeRunsAllowed + (box.homeRunsAllowed ?? 0),
  });

  return { ...player, seasonStats: add(season), careerStats: add(career) };
}

/**
 * Internal helper: accumulate stats from explicit batter/pitcher arrays into a roster.
 */
function accumulateFromArrays(
  roster: Player[],
  batters: PlayerBoxScore[],
  pitchers: PitcherBoxScore[],
): Player[] {
  return roster.map((player) => {
    let p = initializeIfNeeded(player);

    if (isBatter(p)) {
      const box = batters.find((b) => b.playerId === p.id);
      if (box) p = accumulateBatter(p, box);
    } else if (isPitcher(p)) {
      const box = pitchers.find((b) => b.playerId === p.id);
      if (box) p = accumulatePitcher(p, box);
    }

    return p;
  });
}

/**
 * Accumulate stats from a BoxScore into both teams' rosters.
 * "home" = first arg to simulateMatch (boxScore.my*), "away" = second arg (boxScore.opponent*).
 */
export function accumulateMatchStats(
  homeRoster: Player[],
  awayRoster: Player[],
  boxScore: BoxScore,
): { homeRoster: Player[]; awayRoster: Player[] } {
  return {
    homeRoster: accumulateFromArrays(homeRoster, boxScore.myBatters, boxScore.myPitchers),
    awayRoster: accumulateFromArrays(awayRoster, boxScore.opponentBatters, boxScore.opponentPitchers),
  };
}

/**
 * Reset season stats to zero (called on new season). Career stats are preserved.
 */
export function resetSeasonStats(player: Player): Player {
  const empty = isBatter(player) ? { ...EMPTY_BATTER_STATS } : { ...EMPTY_PITCHER_STATS };
  return { ...player, seasonStats: empty };
}
