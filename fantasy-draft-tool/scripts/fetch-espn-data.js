import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public/data");
const DEFAULT_SEASON = new Date().getFullYear();
const DEFAULT_SPORT = "flb";
const DEFAULT_CHUNK_SIZE = 50;
const DEFAULT_MAX_PLAYERS = 600;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildCookieHeader() {
  const espnS2 = optionalEnv("ESPN_S2");
  const swid = optionalEnv("SWID");
  const cookies = [];

  if (espnS2) {
    cookies.push(`espn_s2=${espnS2}`);
  }
  if (swid) {
    cookies.push(`SWID=${swid}`);
  }

  return cookies.length > 0 ? cookies.join("; ") : null;
}

function buildHeaders(extraHeaders = {}) {
  const cookie = buildCookieHeader();
  return {
    accept: "application/json",
    ...(cookie ? { cookie } : {}),
    ...extraHeaders,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Request failed (${response.status} ${response.statusText}): ${text.slice(0, 300)}`,
    );
  }
  return response.json();
}

function leagueEndpoint({ season, leagueId, views }) {
  const url = new URL(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/${DEFAULT_SPORT}/seasons/${season}/segments/0/leagues/${leagueId}`,
  );

  views.forEach((view) => url.searchParams.append("view", view));
  return url;
}

function playerFilter(offset, limit) {
  return JSON.stringify({
    players: {
      limit,
      offset,
      sortDraftRanks: {
        sortPriority: 100,
        sortAsc: true,
        value: "STANDARD",
      },
    },
  });
}

async function fetchLeagueCore({ season, leagueId }) {
  const url = leagueEndpoint({
    season,
    leagueId,
    views: ["mSettings", "mDraftDetail", "mTeam"],
  });

  return fetchJson(url, { headers: buildHeaders() });
}

async function fetchPlayerChunk({ season, leagueId, offset, limit }) {
  const url = leagueEndpoint({
    season,
    leagueId,
    views: ["kona_player_info"],
  });

  return fetchJson(url, {
    headers: buildHeaders({
      "x-fantasy-filter": playerFilter(offset, limit),
    }),
  });
}

function normalizePlayer(entry) {
  const ownership = entry.player?.ownership ?? {};
  const ratingBucket = entry.ratings?.[0] ?? entry.ratings?.["0"] ?? {};

  return {
    id: entry.player?.id ?? entry.id,
    fullName: entry.player?.fullName ?? "Unknown Player",
    defaultPositionId: entry.player?.defaultPositionId ?? null,
    eligibleSlots: entry.player?.eligibleSlots ?? [],
    proTeamId: entry.player?.proTeamId ?? null,
    onTeamId: entry.onTeamId ?? 0,
    status: entry.status ?? null,
    lineupLocked: entry.lineupLocked ?? false,
    injuryStatus: entry.player?.injuryStatus ?? null,
    percentOwned: ownership.percentOwned ?? null,
    averageDraftPosition: ownership.averageDraftPosition ?? null,
    totalRanking: ratingBucket.totalRanking ?? null,
    positionalRanking: ratingBucket.positionalRanking ?? null,
    totalRating: ratingBucket.totalRating ?? null,
  };
}

function buildAutoPickApproximation(players, draftedIds) {
  return players
    .filter((player) => !draftedIds.has(player.id))
    .filter((player) => player.onTeamId === 0)
    .sort((left, right) => {
      const leftRank = left.totalRanking ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.totalRanking ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftAdp = left.averageDraftPosition ?? Number.MAX_SAFE_INTEGER;
      const rightAdp = right.averageDraftPosition ?? Number.MAX_SAFE_INTEGER;
      if (leftAdp !== rightAdp) {
        return leftAdp - rightAdp;
      }

      return left.fullName.localeCompare(right.fullName);
    })
    .map((player, index) => ({
      rank: index + 1,
      playerId: player.id,
      name: player.fullName,
      totalRanking: player.totalRanking,
      averageDraftPosition: player.averageDraftPosition,
      onTeamId: player.onTeamId,
      injuryStatus: player.injuryStatus,
    }));
}

function normalizeTeams(teams = []) {
  return teams.map((team) => ({
    id: team.id,
    abbrev: team.abbrev,
    location: team.location,
    nickname: team.nickname,
    primaryOwner: team.primaryOwner,
  }));
}

async function main() {
  ensureDir(PUBLIC_DIR);

  const leagueId = requiredEnv("ESPN_LEAGUE_ID");
  const season = Number.parseInt(
    process.env.ESPN_SEASON ?? String(DEFAULT_SEASON),
    10,
  );
  const maxPlayers = Number.parseInt(
    process.env.ESPN_MAX_PLAYERS ?? String(DEFAULT_MAX_PLAYERS),
    10,
  );
  const chunkSize = Number.parseInt(
    process.env.ESPN_CHUNK_SIZE ?? String(DEFAULT_CHUNK_SIZE),
    10,
  );
  const outputPath = path.join(PUBLIC_DIR, "espn-league-data.json");
  const fetchedAt = Date.now();

  console.log(`[ESPN] Fetching league ${leagueId} (${season})...`);
  const leagueData = await fetchLeagueCore({ season, leagueId });

  const players = [];
  for (let offset = 0; offset < maxPlayers; offset += chunkSize) {
    const chunk = await fetchPlayerChunk({
      season,
      leagueId,
      offset,
      limit: chunkSize,
    });

    const entries = chunk.players ?? [];
    if (entries.length === 0) {
      break;
    }

    players.push(...entries.map(normalizePlayer));

    if (entries.length < chunkSize) {
      break;
    }
  }

  const draftedPicks = leagueData.draftDetail?.picks ?? [];
  const draftedIds = new Set(
    draftedPicks
      .map((pick) => pick.playerId)
      .filter((playerId) => Number.isFinite(playerId)),
  );

  const payload = {
    fetchedAt,
    source: "espn-unofficial-api",
    note: "Future ESPN autopick order is not directly exposed. autoPickApproximation is a best-effort ranking of currently available players based on ESPN draft ranks and ADP.",
    league: {
      id: Number(leagueData.id ?? leagueId),
      season,
      name: leagueData.settings?.name ?? null,
      status: leagueData.status ?? null,
      scoringType: leagueData.settings?.scoringSettings?.matchupPeriodCount
        ? "H2H"
        : null,
      draftDetail: {
        drafted: leagueData.draftDetail?.drafted ?? null,
        inProgress: leagueData.draftDetail?.inProgress ?? null,
        completeDate: leagueData.draftDetail?.completeDate ?? null,
        pickOrder: leagueData.settings?.draftSettings?.pickOrder ?? null,
        type: leagueData.settings?.draftSettings?.type ?? null,
      },
      teams: normalizeTeams(leagueData.teams),
    },
    draftPicks: draftedPicks.map((pick) => ({
      overallPickNumber: pick.overallPickNumber,
      roundId: pick.roundId,
      roundPickNumber: pick.roundPickNumber,
      teamId: pick.teamId,
      playerId: pick.playerId,
      autoDraftTypeId: pick.autoDraftTypeId,
      lineupSlotId: pick.lineupSlotId,
    })),
    availablePlayers: players,
    autoPickApproximation: buildAutoPickApproximation(players, draftedIds),
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`[ESPN] Saved ${outputPath}`);
  console.log(`[ESPN] Players fetched: ${players.length}`);
  console.log(`[ESPN] Drafted picks: ${draftedPicks.length}`);
}

main().catch((error) => {
  console.error("[ESPN] Fatal error:", error);
  process.exit(1);
});
