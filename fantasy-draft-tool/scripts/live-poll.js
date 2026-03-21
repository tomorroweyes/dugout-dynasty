/**
 * Live Draft Poll Script
 * Polls the ESPN API during a live or mock draft, updating espn-league-data.json
 * whenever new picks are detected.
 *
 * Usage:
 *   ESPN_LEAGUE_ID=xxx [ESPN_S2=xxx] [SWID=xxx] node scripts/live-poll.js
 *
 * Optional env vars:
 *   ESPN_SEASON       — defaults to current year
 *   ESPN_POLL_MS      — poll interval in ms (default: 15000)
 *   ESPN_MAX_PLAYERS  — max players to fetch (default: 300)
 *   ESPN_CHUNK_SIZE   — fetch chunk size (default: 50)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public/data");
const OUTPUT_PATH = path.join(PUBLIC_DIR, "espn-league-data.json");
const DEFAULT_SEASON = new Date().getFullYear();
const DEFAULT_SPORT = "flb";
const POLL_INTERVAL_MS = Number(process.env.ESPN_POLL_MS ?? 15_000);
const DEFAULT_MAX_PLAYERS = 300;
const DEFAULT_CHUNK_SIZE = 50;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optionalEnv(name) {
  return process.env[name]?.trim() || null;
}

function buildCookieHeader() {
  const parts = [];
  const s2 = optionalEnv("ESPN_S2");
  const swid = optionalEnv("SWID");
  if (s2) parts.push(`espn_s2=${s2}`);
  if (swid) parts.push(`SWID=${swid}`);
  return parts.length > 0 ? parts.join("; ") : null;
}

function buildHeaders(extra = {}) {
  const cookie = buildCookieHeader();
  return { accept: "application/json", ...(cookie ? { cookie } : {}), ...extra };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function leagueUrl(leagueId, season, views) {
  const url = new URL(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/${DEFAULT_SPORT}/seasons/${season}/segments/0/leagues/${leagueId}`,
  );
  views.forEach((v) => url.searchParams.append("view", v));
  return url;
}

function playerFilter(offset, limit) {
  return JSON.stringify({
    players: {
      limit,
      offset,
      sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "STANDARD" },
    },
  });
}

function normalizePlayer(entry) {
  const ownership = entry.player?.ownership ?? {};
  const ratingBucket = entry.ratings?.[0] ?? entry.ratings?.["0"] ?? {};
  return {
    id: entry.player?.id ?? entry.id,
    fullName: entry.player?.fullName ?? "Unknown",
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
    .filter((p) => !draftedIds.has(p.id) && p.onTeamId === 0)
    .sort((a, b) => {
      const ra = a.totalRanking ?? Number.MAX_SAFE_INTEGER;
      const rb = b.totalRanking ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      const aa = a.averageDraftPosition ?? Number.MAX_SAFE_INTEGER;
      const ab = b.averageDraftPosition ?? Number.MAX_SAFE_INTEGER;
      if (aa !== ab) return aa - ab;
      return a.fullName.localeCompare(b.fullName);
    })
    .map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      name: p.fullName,
      totalRanking: p.totalRanking,
      averageDraftPosition: p.averageDraftPosition,
      onTeamId: p.onTeamId,
      injuryStatus: p.injuryStatus,
    }));
}

async function fetchSnapshot(leagueId, season, maxPlayers, chunkSize) {
  const leagueData = await fetchJson(leagueUrl(leagueId, season, ["mSettings", "mDraftDetail", "mTeam", "mRoster"]), {
    headers: buildHeaders(),
  });

  const players = [];
  for (let offset = 0; offset < maxPlayers; offset += chunkSize) {
    const chunk = await fetchJson(leagueUrl(leagueId, season, ["kona_player_info"]), {
      headers: buildHeaders({ "x-fantasy-filter": playerFilter(offset, chunkSize) }),
    });
    const entries = chunk.players ?? [];
    players.push(...entries.map(normalizePlayer));
    if (entries.length < chunkSize) break;
  }

  // ESPN pre-populates all picks as placeholders (playerId: -1) during in-progress
  // mock drafts and does not update them in real-time. Instead, derive picks from
  // the player pool: players with onTeamId !== 0 have been drafted.
  const inProgress = leagueData.draftDetail?.inProgress ?? false;
  const rawPicks = leagueData.draftDetail?.picks ?? [];
  const rawPicksHaveRealIds = rawPicks.some((p) => p.playerId > 0);

  let draftedPicks;
  if (inProgress && !rawPicksHaveRealIds) {
    // Derive from player roster assignments — ESPN updates onTeamId in real-time
    const numTeams = leagueData.teams?.length ?? 8;
    const pickedPlayers = players.filter((p) => p.onTeamId !== 0);
    draftedPicks = pickedPlayers.map((p, i) => ({
      overallPickNumber: i + 1,
      roundId: Math.ceil((i + 1) / numTeams),
      roundPickNumber: ((i) % numTeams) + 1,
      teamId: p.onTeamId,
      playerId: p.id,
      autoDraftTypeId: 0,
      lineupSlotId: 0,
    }));
  } else {
    draftedPicks = rawPicks.filter((p) => p.playerId > 0);
  }

  const draftedIds = new Set(draftedPicks.map((p) => p.playerId).filter(Number.isFinite));

  const teams = (leagueData.teams ?? []).map((t) => ({
    id: t.id,
    abbrev: t.abbrev,
    location: t.location,
    nickname: t.nickname,
    primaryOwner: t.primaryOwner,
  }));

  return {
    fetchedAt: Date.now(),
    source: "espn-unofficial-api",
    note: "Live-polled during draft. autoPickApproximation reflects currently available players.",
    league: {
      id: Number(leagueData.id ?? leagueId),
      season,
      name: leagueData.settings?.name ?? null,
      status: leagueData.status ?? null,
      scoringType: leagueData.settings?.scoringSettings?.matchupPeriodCount ? "H2H" : null,
      draftDetail: {
        drafted: leagueData.draftDetail?.drafted ?? null,
        inProgress: leagueData.draftDetail?.inProgress ?? null,
        completeDate: leagueData.draftDetail?.completeDate ?? null,
        pickOrder: leagueData.settings?.draftSettings?.pickOrder ?? null,
        type: leagueData.settings?.draftSettings?.type ?? null,
      },
      teams,
    },
    draftPicks: draftedPicks.map((p) => ({
      overallPickNumber: p.overallPickNumber,
      roundId: p.roundId,
      roundPickNumber: p.roundPickNumber,
      teamId: p.teamId,
      playerId: p.playerId,
      autoDraftTypeId: p.autoDraftTypeId,
      lineupSlotId: p.lineupSlotId,
    })),
    availablePlayers: players,
    autoPickApproximation: buildAutoPickApproximation(players, draftedIds),
  };
}

function teamLabel(teams, teamId) {
  const t = teams.find((tm) => tm.id === teamId);
  return t?.abbrev ?? `team${teamId}`;
}

async function poll(leagueId, season, maxPlayers, chunkSize) {
  let lastPickCount = -1;
  let lastTeams = [];

  console.log(`[Live] Polling league ${leagueId} every ${POLL_INTERVAL_MS / 1000}s`);
  console.log("[Live] Press Ctrl+C to stop.\n");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const snapshot = await fetchSnapshot(leagueId, season, maxPlayers, chunkSize);
      const pickCount = snapshot.draftPicks.filter((p) => p.playerId > 0).length;
      lastTeams = snapshot.league.teams;

      if (pickCount !== lastPickCount) {
        // Write updated file
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2));

        if (lastPickCount === -1) {
          console.log(`[Live] Connected — ${pickCount} picks already made`);
        } else {
          // Log new picks
          const allPlayers = snapshot.availablePlayers;
          const playerById = new Map(allPlayers.map((p) => [p.id, p.fullName]));
          const newPicks = snapshot.draftPicks
            .filter((p) => p.playerId > 0)
            .slice(lastPickCount);
          for (const pick of newPicks) {
            const name = playerById.get(pick.playerId) ?? `player#${pick.playerId}`;
            const team = teamLabel(lastTeams, pick.teamId);
            console.log(`[Live] Pick ${pick.overallPickNumber}: ${name} → ${team}`);
          }
        }

        lastPickCount = pickCount;
      } else {
        process.stdout.write(".");
      }
    } catch (err) {
      console.error(`\n[Live] Poll error: ${err.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

const leagueId = requiredEnv("ESPN_LEAGUE_ID");
const season = Number(process.env.ESPN_SEASON ?? DEFAULT_SEASON);
const maxPlayers = Number(process.env.ESPN_MAX_PLAYERS ?? DEFAULT_MAX_PLAYERS);
const chunkSize = Number(process.env.ESPN_CHUNK_SIZE ?? DEFAULT_CHUNK_SIZE);

poll(leagueId, season, maxPlayers, chunkSize).catch((err) => {
  console.error("[Live] Fatal:", err.message);
  process.exit(1);
});
