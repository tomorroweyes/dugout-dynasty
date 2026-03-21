/**
 * Data Build Script
 * Runs nightly (4 AM UTC) to fetch fresh stats, injury data, and generate draft-data.json
 *
 * Usage: node scripts/build.js
 * Outputs: public/data/draft-data.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public/data");
const SEASON = 2025;
const HISTORICAL_SEASONS = [2023, 2024];
const SPORT_ID = 1;
const MLB_STATS_API = "https://statsapi.mlb.com/api/v1/stats";
const MIN_BATTER_PA = 150;
const MIN_PITCHER_BF = 100;
// Expert-ranked players are included with a much lower PA floor so that
// injury-shortened seasons don't erase top talent from the pool.
const SAFELIST_MIN_PA = 50;

// Ensure output directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

/**
 * Fetch JSON from MLB Stats API for a specific season
 */
async function fetchStats(params, season = SEASON) {
  const url = new URL(MLB_STATS_API);
  Object.entries({
    sportIds: String(SPORT_ID),
    season: String(season),
    playerPool: "ALL",
    limit: "2000",
    ...params,
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `MLB Stats API request failed (${res.status} ${res.statusText})`,
    );
  }

  return res.json();
}

/**
 * Parse numeric strings safely
 */
function parseNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Normalize MLB positions to the simplified draft board positions.
 */
function mapBatterPosition(abbreviation) {
  if (!abbreviation) {
    return "DH";
  }

  if (["LF", "CF", "RF"].includes(abbreviation)) {
    return "OF";
  }

  if (["C", "1B", "2B", "3B", "SS", "OF", "DH"].includes(abbreviation)) {
    return abbreviation;
  }

  return "DH";
}

/**
 * Infer a fantasy pitcher role from usage.
 */
function inferPitcherRole(stat) {
  if ((stat.gamesStarted ?? 0) >= 5) {
    return "SP";
  }

  if (
    (stat.holds ?? 0) > 0 ||
    (stat.saves ?? 0) > 0 ||
    (stat.gamesFinished ?? 0) >= 5
  ) {
    return "RP";
  }

  return (stat.gamesStarted ?? 0) > 0 ? "SP" : "RP";
}

/**
 * Fetch raw batting stats for a given season.
 * Returns a Map keyed by mlbId → batting stat object.
 */
async function fetchRawBattingStats(season, safelistNames = new Set()) {
  console.log(`[Data] Fetching batting stats for ${season}...`);
  try {
    const data = await fetchStats({ stats: "season", group: "hitting" }, season);
    const splits = data?.stats?.[0]?.splits ?? [];
    const result = new Map();
    for (const split of splits) {
      const stat = split.stat ?? {};
      const pa = parseNumber(stat.plateAppearances);
      const name = split.player?.fullName ?? "";
      const minPa = safelistNames.has(name) ? SAFELIST_MIN_PA : MIN_BATTER_PA;
      if (pa < minPa) continue; // PA threshold filters out pitchers who rarely bat
      result.set(split.player.id, {
        pa,
        h: parseNumber(stat.hits),
        r: parseNumber(stat.runs),
        hr: parseNumber(stat.homeRuns),
        rbi: parseNumber(stat.rbi),
        sb: parseNumber(stat.stolenBases),
        avg: parseNumber(stat.avg),
        obp: parseNumber(stat.obp),
        slg: parseNumber(stat.slg),
        ops: parseNumber(stat.ops),
      });
    }
    return result;
  } catch (err) {
    console.warn(`[Data] Warning: could not fetch batting stats for ${season}: ${err.message}`);
    return new Map();
  }
}

/**
 * Fetch raw pitching stats for a given season.
 * Returns a Map keyed by mlbId → pitching stat object.
 */
async function fetchRawPitchingStats(season) {
  console.log(`[Data] Fetching pitching stats for ${season}...`);
  try {
    const [seasonData, advancedData] = await Promise.all([
      fetchStats({ stats: "season", group: "pitching" }, season),
      fetchStats({ stats: "seasonAdvanced", group: "pitching" }, season),
    ]);

    const advancedByPlayer = new Map(
      (advancedData?.stats?.[0]?.splits ?? []).map((split) => [
        split.player.id,
        split.stat ?? {},
      ]),
    );

    const result = new Map();
    for (const split of seasonData?.stats?.[0]?.splits ?? []) {
      const posAbbr = split?.position?.abbreviation;
      if (posAbbr !== "P" && posAbbr !== "TWP") continue;
      const stat = split.stat ?? {};
      const bf = parseNumber(stat.battersFaced);
      if (bf < MIN_PITCHER_BF) continue;
      const advanced = advancedByPlayer.get(split.player.id) ?? {};
      const kRate = parseNumber(stat.strikeoutsPer9Inn) / 9;
      const walkRate = parseNumber(stat.walksPer9Inn) / 9;
      const holds = parseNumber(stat.holds);
      const saves = parseNumber(stat.saves);
      result.set(split.player.id, {
        pa: bf,
        ip: parseNumber(stat.inningsPitched),
        k: parseNumber(stat.strikeOuts),
        kpct: kRate,
        bbpct: walkRate,
        era: parseNumber(stat.era, 4.5),
        whip: parseNumber(stat.whip, 1.3),
        qs: parseNumber(advanced.qualityStarts),
        svhd: holds + saves,
      });
    }
    return result;
  } catch (err) {
    console.warn(`[Data] Warning: could not fetch pitching stats for ${season}: ${err.message}`);
    return new Map();
  }
}

/**
 * Fetch 2025 batting stats from MLB Stats API.
 */
async function fetchBattingStats(timestamp, safelistNames = new Set()) {
  console.log("[Data] Fetching 2025 batting stats from MLB Stats API...");

  const data = await fetchStats({ stats: "season", group: "hitting" }, SEASON);
  const splits = data?.stats?.[0]?.splits ?? [];

  return splits
    .filter((split) => {
      const pa = split?.stat?.plateAppearances ?? 0;
      const name = split?.player?.fullName ?? "";
      const minPa = safelistNames.has(name) ? SAFELIST_MIN_PA : MIN_BATTER_PA;
      return pa >= minPa; // PA threshold filters out pitchers who rarely bat
    })
    .map((split) => {
      const stat = split.stat ?? {};
      const position = mapBatterPosition(split?.position?.abbreviation);
      const ops = parseNumber(stat.ops);

      return {
        id: `bat-${split.player.id}`,
        name: split.player.fullName,
        mlbId: split.player.id,
        type: "batter",
        position,
        positions: [position],
        tier: "5", // overwritten at runtime by evaluatePlayers()
        batting: {
          pa: parseNumber(stat.plateAppearances),
          h: parseNumber(stat.hits),
          r: parseNumber(stat.runs),
          hr: parseNumber(stat.homeRuns),
          rbi: parseNumber(stat.rbi),
          sb: parseNumber(stat.stolenBases),
          avg: parseNumber(stat.avg),
          obp: parseNumber(stat.obp),
          slg: parseNumber(stat.slg),
          ops,
        },
        injured: false,
        lastUpdated: timestamp,
      };
    });
}

/**
 * Fetch 2025 pitching stats from MLB Stats API.
 */
async function fetchPitchingStats(timestamp) {
  console.log("[Data] Fetching 2025 pitching stats from MLB Stats API...");

  const [seasonData, advancedData] = await Promise.all([
    fetchStats({ stats: "season", group: "pitching" }, SEASON),
    fetchStats({ stats: "seasonAdvanced", group: "pitching" }, SEASON),
  ]);

  const advancedByPlayer = new Map(
    (advancedData?.stats?.[0]?.splits ?? []).map((split) => [
      split.player.id,
      split.stat ?? {},
    ]),
  );

  return (seasonData?.stats?.[0]?.splits ?? [])
    .filter((split) => split?.position?.abbreviation === "P" || split?.position?.abbreviation === "TWP")
    .filter((split) => (split?.stat?.battersFaced ?? 0) >= MIN_PITCHER_BF)
    .map((split) => {
      const stat = split.stat ?? {};
      const advanced = advancedByPlayer.get(split.player.id) ?? {};
      const role = inferPitcherRole(stat);
      const kRate = parseNumber(stat.strikeoutsPer9Inn) / 9;
      const walkRate = parseNumber(stat.walksPer9Inn) / 9;
      const holds = parseNumber(stat.holds);
      const saves = parseNumber(stat.saves);

      return {
        id: `pit-${split.player.id}`,
        name: split.player.fullName,
        mlbId: split.player.id,
        type: "pitcher",
        position: role,
        positions: [role],
        tier: "5", // overwritten at runtime by evaluatePlayers()
        pitching: {
          pa: parseNumber(stat.battersFaced),
          ip: parseNumber(stat.inningsPitched),
          k: parseNumber(stat.strikeOuts),
          kpct: kRate,
          bbpct: walkRate,
          era: parseNumber(stat.era, 4.5),
          whip: parseNumber(stat.whip, 1.3),
          qs: parseNumber(advanced.qualityStarts),
          svhd: holds + saves,
        },
        injured: false,
        lastUpdated: timestamp,
      };
    });
}

/**
 * Your league configuration
 */
const LEAGUE_CONFIG = {
  name: "2025 EELite League",
  teams: 8,
  format: "H2H",
  scoringType: "most-categories",
  roster: {
    batting: "1C, 1B, 2B, 3B, SS, 3OF, 1DH, 2UTIL (9 starters)",
    pitching: "6SP, 3RP (9 starters)",
    bench: 3,
    il: 3,
  },
  scoringCategories: {
    batting: ["H", "R", "HR", "RBI", "SB", "OPS"],
    pitching: ["K", "QS", "ERA", "WHIP", "SVHD"],
  },
  draftInfo: {
    pickNumber: 1,
    totalPicks: 184, // 8 teams * 23 rounds
    snakeDraft: true,
  },
};

/**
 * Fetch current ages for a list of MLB player IDs.
 * Returns a Map keyed by mlbId → currentAge (number).
 */
async function fetchPlayerAges(mlbIds) {
  if (mlbIds.length === 0) return new Map();
  console.log(`[Data] Fetching ages for ${mlbIds.length} players...`);
  const MLB_PEOPLE_API = "https://statsapi.mlb.com/api/v1/people";
  const BATCH_SIZE = 100;
  const result = new Map();
  for (let i = 0; i < mlbIds.length; i += BATCH_SIZE) {
    const batch = mlbIds.slice(i, i + BATCH_SIZE);
    try {
      const url = new URL(MLB_PEOPLE_API);
      url.searchParams.set("personIds", batch.join(","));
      url.searchParams.set("fields", "people,id,currentAge");
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const person of data?.people ?? []) {
        if (person.id != null && person.currentAge != null) {
          result.set(person.id, person.currentAge);
        }
      }
    } catch {
      // skip batch on error
    }
  }
  return result;
}

/**
 * ESPN slot ID → our Position type.
 * Only includes slots that correspond to actual field positions — bench (16),
 * IL (17), UTIL (12), MI combo (6), and CI combo (7) are intentionally excluded.
 */
const ESPN_SLOT_TO_POSITION = {
  0: "C",
  1: "1B",
  2: "2B",
  3: "3B",
  4: "SS",
  5: "OF",
  11: "DH",
  14: "SP",
  15: "RP",
};

/**
 * Manual position overrides for players where ESPN eligibility hasn't yet
 * caught up to a real-world position change. Primary position listed first.
 * Sources: Mike Kurland (X), r/fantasybaseball preseason thread, March 2026.
 *
 * Update as ESPN catches up during the season and these become unnecessary.
 */
const POSITION_OVERRIDES = {
  // --- Early-season locks (should qualify within first few weeks) ---
  "Bo Bichette":       ["3B", "SS"],      // SD - full-time 3B now
  "Gavin Lux":         ["2B", "DH"],      // Reds - moving to 2B
  "Jake Cronenworth":  ["1B", "2B"],      // Marlins - moving to 1B
  "Christian Moore":   ["3B", "2B"],      // Angels - moving to 3B
  "Connor Norby":      ["1B", "3B"],      // Orioles - moving to 1B
  "Brendan Donovan":   ["2B", "3B"],      // Mariners - will play 3B
  "Jorge Polanco":     ["2B", "1B", "DH"],// Mets - adding 1B
  "Kristian Campbell": ["2B", "OF"],      // Red Sox - gaining OF
  "Luisangel Acuña":   ["2B", "OF"],      // Mets - gaining OF
  "Luis Arraez":       ["1B", "2B", "DH"],// Padres - will play 2B
  "Iván Herrera":      ["C", "DH"],       // Cardinals - moving to C
  // --- Likely within a month ---
  "Isaac Paredes":     ["3B", "2B"],      // Cubs - moving to 2B
  "Matt Shaw":         ["3B", "OF"],      // Cubs - gaining OF
  "Brett Baty":        ["3B", "OF"],      // Mets - gaining OF
  // --- Speculative (remove if doesn't pan out) ---
  "Gavin Sheets":      ["OF", "1B"],      // gaining 1B
  "Christian Yelich":  ["DH", "OF"],      // skeptical per community; monitor
};

/**
 * Merge ESPN eligibleSlots into each player's positions[] array.
 * Falls back to the player's existing positions if no ESPN match is found.
 */
function mergeEspnPositions(players, espnPlayers) {
  const espnByName = new Map(
    espnPlayers.map((p) => [p.fullName.toLowerCase(), p]),
  );

  return players.map((player) => {
    // Manual override takes priority over ESPN data
    const override = POSITION_OVERRIDES[player.name];
    if (override) {
      return { ...player, position: override[0], positions: override };
    }

    const espnPlayer = espnByName.get(player.name.toLowerCase());
    if (!espnPlayer?.eligibleSlots?.length) return player;

    const positions = [
      ...new Set(
        espnPlayer.eligibleSlots
          .map((slot) => ESPN_SLOT_TO_POSITION[slot])
          .filter(Boolean),
      ),
    ];

    if (positions.length === 0) return player;

    // Keep the player's current primary position if ESPN confirms it; otherwise
    // use the first ESPN-derived position as primary.
    const primaryPos = positions.includes(player.position)
      ? player.position
      : positions[0];

    return { ...player, position: primaryPos, positions };
  });
}

/**
 * Build and save final data
 */
async function build() {
  console.log("[Data] Starting data build...");
  const startTime = Date.now();
  const fetchedAt = Date.now();

  // Load expert rankings to safelist top players regardless of PA (injury seasons)
  const expertRankingsPath = path.join(PUBLIC_DIR, "expert-rankings.json");
  const safelistNames = new Set();
  if (fs.existsSync(expertRankingsPath)) {
    try {
      const rankings = JSON.parse(fs.readFileSync(expertRankingsPath, "utf-8"));
      rankings.forEach((r) => safelistNames.add(r.name));
      console.log(`[Data] Safelist: ${safelistNames.size} expert-ranked players (PA floor: ${SAFELIST_MIN_PA})`);
    } catch {
      console.warn("[Data] Warning: could not load expert-rankings.json for safelist");
    }
  }

  // Fetch current season and historical seasons in parallel
  const [batters, pitchers, ...historicalResults] = await Promise.all([
    fetchBattingStats(fetchedAt, safelistNames),
    fetchPitchingStats(fetchedAt),
    ...HISTORICAL_SEASONS.map(async (season) => {
      const [batting, pitching] = await Promise.all([
        fetchRawBattingStats(season, safelistNames),
        fetchRawPitchingStats(season),
      ]);
      return { season, batting, pitching };
    }),
  ]);

  // Merge two-way players: a player who appears in both batters and pitchers
  // gets a single combined record with both batting and pitching stats.
  const pitcherByMlbId = new Map(pitchers.filter((p) => p.mlbId).map((p) => [p.mlbId, p]));
  const mergedBatters = batters.map((batter) => {
    if (!batter.mlbId) return batter;
    const matchingPitcher = pitcherByMlbId.get(batter.mlbId);
    if (!matchingPitcher) return batter;
    // Merge: keep batter as base, add pitching stats, expand positions, use batter id
    pitcherByMlbId.delete(batter.mlbId); // don't emit as separate pitcher
    return {
      ...batter,
      pitching: matchingPitcher.pitching,
      positions: [...new Set([...(batter.positions ?? [batter.position]), ...(matchingPitcher.positions ?? [matchingPitcher.position])])],
    };
  });
  const remainingPitchers = [...pitcherByMlbId.values()];

  // Fetch ages for all players
  const allMlbIds = [...mergedBatters, ...remainingPitchers]
    .map((p) => p.mlbId)
    .filter(Boolean);
  const ageMap = await fetchPlayerAges(allMlbIds);

  // Attach previousSeasons to each player
  const allPlayers = [...mergedBatters, ...remainingPitchers].map((player) => {
    const previousSeasons = [];
    for (const { season, batting, pitching } of historicalResults) {
      if (!player.mlbId) continue;
      if (player.type === "batter") {
        const batStats = batting.get(player.mlbId);
        if (batStats) {
          previousSeasons.push({ season, batting: batStats });
        }
        // Two-way: also capture historical pitching
        const pitStats = pitching.get(player.mlbId);
        if (pitStats && player.pitching) {
          previousSeasons.push({ season, pitching: pitStats });
        }
      } else {
        const pitStats = pitching.get(player.mlbId);
        if (pitStats) {
          previousSeasons.push({ season, pitching: pitStats });
        }
      }
    }
    // Sort chronologically
    previousSeasons.sort((a, b) => a.season - b.season);
    const age = player.mlbId ? ageMap.get(player.mlbId) : undefined;
    const withHistory = previousSeasons.length > 0 ? { ...player, previousSeasons } : player;
    return age != null ? { ...withHistory, age } : withHistory;
  });

  // Merge ESPN position eligibility into players[] so multi-position players
  // show up correctly in position filters and slot-assignment logic.
  const espnPath = path.join(PUBLIC_DIR, "espn-league-data.json");
  let espnPlayers = [];
  if (fs.existsSync(espnPath)) {
    try {
      const espnData = JSON.parse(fs.readFileSync(espnPath, "utf-8"));
      espnPlayers = espnData.availablePlayers ?? [];
      console.log(`[Data] Loaded ESPN data for position merging: ${espnPlayers.length} players`);
    } catch {
      console.warn("[Data] Warning: could not load espn-league-data.json for position merging");
    }
  }
  const playersWithPositions = mergeEspnPositions(allPlayers, espnPlayers);

  const draftData = {
    league: LEAGUE_CONFIG,
    players: playersWithPositions,
    fetchedAt,
    dataVersion: "1.1.0",
  };

  // Write to file
  const outPath = path.join(PUBLIC_DIR, "draft-data.json");
  fs.writeFileSync(outPath, JSON.stringify(draftData, null, 2));

  const elapsed = Date.now() - startTime;
  console.log(`[Data] ✅ Build complete! (${elapsed}ms)`);
  console.log(`[Data] Saved: ${outPath}`);
  const twoWayCount = mergedBatters.filter((p) => p.pitching).length;
  console.log(
    `[Data] Players: ${allPlayers.length} (${mergedBatters.length} batters incl. ${twoWayCount} two-way, ${remainingPitchers.length} pitchers)`,
  );
  const withHistory = allPlayers.filter((p) => p.previousSeasons?.length > 0).length;
  console.log(`[Data] Players with historical data: ${withHistory}`);
}

build().catch((err) => {
  console.error("[Data] Fatal error:", err);
  process.exit(1);
});
