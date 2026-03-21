/**
 * fetch-espn-history.js
 *
 * Fetches completed draft picks for each past season and writes
 * public/data/draft-history.json. The output contains per-season pick logs
 * enriched with player name, position, and class (BAT / SP / RP) so the
 * draft tool can surface manager-level tendencies (e.g. "when does this
 * owner take their first pitcher?").
 *
 * Usage:
 *   ESPN_LEAGUE_ID=116792533 ESPN_S2=<cookie> SWID=<cookie> \
 *     node scripts/fetch-espn-history.js
 *
 * Optional env vars:
 *   ESPN_HISTORY_SEASONS   comma-separated list of seasons, e.g. "2022,2023,2024,2025"
 *                          defaults to the last five completed seasons
 *   ESPN_CHUNK_SIZE        player-fetch page size (default 50)
 *   ESPN_MAX_PLAYERS       max players to fetch per season (default 300)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public/data");
const DEFAULT_SPORT = "flb";
const DEFAULT_CHUNK_SIZE = 50;
const DEFAULT_MAX_PLAYERS = 300;
const CURRENT_YEAR = new Date().getFullYear();

// Default: 2024 and 2025 (seasons Cam has access to in this league).
const DEFAULT_SEASONS = [2024, 2025];

// ESPN defaultPositionId → human-readable label (verified from real draft data)
const POSITION_LABEL = {
  1:  "SP",
  2:  "C",
  3:  "1B",
  4:  "2B",
  5:  "3B",
  6:  "SS",
  7:  "LF",
  8:  "CF",
  9:  "RF",
  10: "DH",
  11: "RP",
};

// ESPN defaultPositionId → broad draft class
const PLAYER_CLASS = {
  1:  "SP",
  2:  "BAT",
  3:  "BAT",
  4:  "BAT",
  5:  "BAT",
  6:  "BAT",
  7:  "BAT",
  8:  "BAT",
  9:  "BAT",
  10: "BAT",
  11: "RP",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name) {
  return process.env[name]?.trim() ?? null;
}

function buildCookieHeader() {
  const parts = [];
  const s2 = optionalEnv("ESPN_S2");
  const swid = optionalEnv("SWID");
  if (s2) parts.push(`espn_s2=${s2}`);
  if (swid) parts.push(`SWID=${swid}`);
  return parts.length ? parts.join("; ") : null;
}

function buildHeaders(extra = {}) {
  const cookie = buildCookieHeader();
  return {
    accept: "application/json",
    ...(cookie ? { cookie } : {}),
    ...extra,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText} — ${String(url).slice(0, 120)}\n${text.slice(0, 300)}`,
    );
  }
  return response.json();
}

function leagueUrl(season, leagueId, views) {
  const url = new URL(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/${DEFAULT_SPORT}/seasons/${season}/segments/0/leagues/${leagueId}`,
  );
  views.forEach((v) => url.searchParams.append("view", v));
  return url;
}

function playerFilterHeader(offset, limit) {
  return JSON.stringify({
    players: {
      limit,
      offset,
      // Include all roster statuses so drafted players (onTeamId > 0) are returned.
      filterStatus: { value: ["ONTEAM", "FREEAGENT", "WAIVERS"] },
      sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "STANDARD" },
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Per-season fetchers ─────────────────────────────────────────────────────

async function fetchLeagueAndDraft(season, leagueId) {
  const url = leagueUrl(season, leagueId, ["mSettings", "mDraftDetail", "mTeam"]);
  return fetchJson(url, { headers: buildHeaders() });
}

async function fetchStandings(season, leagueId) {
  const url = leagueUrl(season, leagueId, ["mStandings", "mTeam"]);
  return fetchJson(url, { headers: buildHeaders() });
}

async function fetchPlayerPool(season, leagueId, maxPlayers, chunkSize) {
  const players = [];
  for (let offset = 0; offset < maxPlayers; offset += chunkSize) {
    const url = leagueUrl(season, leagueId, ["kona_player_info"]);
    const data = await fetchJson(url, {
      headers: buildHeaders({
        "x-fantasy-filter": playerFilterHeader(offset, chunkSize),
      }),
    });

    const entries = data.players ?? [];
    for (const entry of entries) {
      const p = entry.player ?? {};
      const ownership = entry.player?.ownership ?? {};
      players.push({
        id: p.id ?? entry.id,
        fullName: p.fullName ?? "Unknown",
        defaultPositionId: p.defaultPositionId ?? null,
        eligibleSlots: p.eligibleSlots ?? [],
        onTeamId: entry.onTeamId ?? 0,
        averageDraftPosition: ownership.averageDraftPosition ?? null,
      });
    }

    if (entries.length < chunkSize) break;
    // Polite pause between chunks to avoid rate-limiting.
    await sleep(200);
  }
  return players;
}

// ─── Data builders ───────────────────────────────────────────────────────────

function buildPlayerMap(players) {
  const map = new Map();
  for (const p of players) {
    map.set(p.id, p);
  }
  return map;
}

function normalizeTeams(teams = []) {
  return teams.map((t) => ({
    id: t.id,
    abbrev: t.abbrev ?? null,
    location: t.location ?? null,
    nickname: t.nickname ?? null,
    primaryOwner: t.primaryOwner ?? null,
  }));
}

function normalizeStandings(teams = []) {
  return teams.map((t) => {
    const record = t.record?.overall ?? {};
    const playoff = t.playoffSeed ?? null;
    return {
      teamId: t.id,
      abbrev: t.abbrev ?? null,
      wins: record.wins ?? null,
      losses: record.losses ?? null,
      ties: record.ties ?? null,
      pointsFor: record.pointsFor ?? null,
      playoffSeed: playoff,
      // finalStanding if available (ESPN sometimes includes it on mStandings)
      finalStanding: t.rankCalculatedFinal ?? t.playoffSeed ?? null,
    };
  });
}

function enrichPicks(rawPicks, playerMap) {
  return rawPicks.map((pick) => {
    const player = playerMap.get(pick.playerId);
    const posId = player?.defaultPositionId ?? null;
    return {
      overall: pick.overallPickNumber,
      round: pick.roundId,
      roundPick: pick.roundPickNumber,
      teamId: pick.teamId,
      playerId: pick.playerId,
      playerName: player?.fullName ?? null,
      defaultPositionId: posId,
      positionLabel: posId != null ? (POSITION_LABEL[posId] ?? `pos${posId}`) : null,
      playerClass: posId != null ? (PLAYER_CLASS[posId] ?? "BAT") : null,
      autoDrafted: pick.autoDraftTypeId === 1,
      adp: player?.averageDraftPosition ?? null,
    };
  });
}

/**
 * Pre-compute per-team manager patterns so the front-end doesn't have to.
 * Each manager entry captures the tendencies the draft tool cares most about.
 */
function buildManagerPatterns(picks, teams) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const byTeam = new Map();

  for (const pick of picks) {
    if (!byTeam.has(pick.teamId)) {
      byTeam.set(pick.teamId, []);
    }
    byTeam.get(pick.teamId).push(pick);
  }

  return Array.from(byTeam.entries()).map(([teamId, teamPicks]) => {
    // Sort by pick order just to be safe.
    const sorted = [...teamPicks].sort((a, b) => a.overall - b.overall);

    // Round of first SP / RP pick.
    const firstSpPick = sorted.find((p) => p.playerClass === "SP");
    const firstRpPick = sorted.find((p) => p.playerClass === "RP");

    // Class distribution per round bucket.
    const earlyRounds = sorted.filter((p) => p.round <= 5);
    const midRounds = sorted.filter((p) => p.round >= 6 && p.round <= 12);
    const lateRounds = sorted.filter((p) => p.round >= 13);

    function classCounts(subset) {
      return subset.reduce(
        (acc, p) => {
          const cls = p.playerClass ?? "UNKNOWN";
          acc[cls] = (acc[cls] ?? 0) + 1;
          return acc;
        },
        {},
      );
    }

    // Detect position "runs" — three or more consecutive picks of the same class.
    const runs = [];
    let runStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      const same =
        i < sorted.length &&
        sorted[i].playerClass === sorted[runStart].playerClass;
      if (!same) {
        if (i - runStart >= 3) {
          runs.push({
            class: sorted[runStart].playerClass,
            startRound: sorted[runStart].round,
            length: i - runStart,
          });
        }
        runStart = i;
      }
    }

    // Pitcher-first flag: did they take a pitcher in rounds 1–3?
    const pitcherFirst = earlyRounds.some(
      (p) => p.playerClass === "SP" || p.playerClass === "RP",
    );

    const team = teamById.get(teamId);

    return {
      teamId,
      abbrev: team?.abbrev ?? null,
      primaryOwner: team?.primaryOwner ?? null,
      totalPicks: sorted.length,
      firstSpRound: firstSpPick?.round ?? null,
      firstRpRound: firstRpPick?.round ?? null,
      pitcherFirstThreeRounds: pitcherFirst,
      earlyClass: classCounts(earlyRounds),
      midClass: classCounts(midRounds),
      lateClass: classCounts(lateRounds),
      runs,
      pickLog: sorted.map((p) => ({
        round: p.round,
        class: p.playerClass,
        position: p.positionLabel,
        name: p.playerName,
        autoDrafted: p.autoDrafted,
      })),
    };
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function processSeason(season, leagueId, maxPlayers, chunkSize) {
  console.log(`\n[History] Season ${season} — fetching…`);

  const leagueData = await fetchLeagueAndDraft(season, leagueId);
  const drafted = leagueData.draftDetail?.drafted ?? false;

  if (!drafted) {
    console.log(`[History] Season ${season} — draft not yet completed, skipping.`);
    return null;
  }

  const rawPicks = leagueData.draftDetail?.picks ?? [];
  if (rawPicks.length === 0) {
    console.log(`[History] Season ${season} — no picks found in draftDetail.`);
    return null;
  }

  console.log(`[History] Season ${season} — ${rawPicks.length} picks found. Fetching player pool…`);

  const playerPool = await fetchPlayerPool(season, leagueId, maxPlayers, chunkSize);
  const playerMap = buildPlayerMap(playerPool);

  const matchedCount = rawPicks.filter((p) => playerMap.has(p.playerId)).length;
  console.log(
    `[History] Season ${season} — player pool: ${playerPool.length}, picks matched: ${matchedCount}/${rawPicks.length}`,
  );

  const teams = normalizeTeams(leagueData.teams ?? []);
  const picks = enrichPicks(rawPicks, playerMap);
  const managerPatterns = buildManagerPatterns(picks, teams);

  console.log(`[History] Season ${season} — fetching standings…`);
  let standings = [];
  try {
    const standingsData = await fetchStandings(season, leagueId);
    standings = normalizeStandings(standingsData.teams ?? []);
  } catch (err) {
    console.warn(`[History] Season ${season} — standings fetch failed: ${err.message}`);
  }

  return {
    seasonId: season,
    drafted: true,
    teams,
    standings,
    picks,
    managerPatterns,
  };
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const leagueId = requiredEnv("ESPN_LEAGUE_ID");
  const maxPlayers = Number.parseInt(
    process.env.ESPN_MAX_PLAYERS ?? String(DEFAULT_MAX_PLAYERS),
    10,
  );
  const chunkSize = Number.parseInt(
    process.env.ESPN_CHUNK_SIZE ?? String(DEFAULT_CHUNK_SIZE),
    10,
  );
  const seasons = (process.env.ESPN_HISTORY_SEASONS ?? "")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 2000);

  const seasonsToFetch = seasons.length > 0 ? seasons : DEFAULT_SEASONS;
  console.log(`[History] Fetching seasons: ${seasonsToFetch.join(", ")}`);

  const results = [];
  for (const season of seasonsToFetch) {
    try {
      const result = await processSeason(season, leagueId, maxPlayers, chunkSize);
      if (result) results.push(result);
    } catch (err) {
      console.warn(`[History] Season ${season} failed: ${err.message}`);
    }
    // Pause between seasons.
    await sleep(500);
  }

  const output = {
    fetchedAt: Date.now(),
    leagueId: Number(leagueId),
    seasons: results,
  };

  const outPath = path.join(PUBLIC_DIR, "draft-history.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n[History] ✅ Saved ${outPath}`);
  console.log(`[History] Seasons with data: ${results.length} of ${seasonsToFetch.length}`);
  results.forEach((s) => {
    console.log(`  ${s.seasonId}: ${s.picks.length} picks, ${s.managerPatterns.length} managers`);
  });
}

main().catch((err) => {
  console.error("[History] Fatal:", err);
  process.exit(1);
});
