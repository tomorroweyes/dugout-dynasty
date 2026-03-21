/**
 * Fetch Projections Script
 * Fetches Steamer 2026 projections from FanGraphs and merges them into draft-data.json.
 *
 * Usage: node scripts/fetch-projections.js
 * Requires: public/data/draft-data.json to exist (run build.js first)
 * Outputs: public/data/draft-data.json (updated in-place)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public/data");
const DRAFT_DATA_PATH = path.join(PUBLIC_DIR, "draft-data.json");

const FANGRAPHS_BATTER_URL =
  "https://www.fangraphs.com/api/projections?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all";
const FANGRAPHS_PITCHER_URL =
  "https://www.fangraphs.com/api/projections?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

function parseNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Fetch JSON from a URL with browser-like headers.
 */
async function fetchJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }
  return res.json();
}

/**
 * Fetch Steamer batter projections from FanGraphs.
 * Returns a Map keyed by mlbamid → projection object, with a name fallback map.
 */
async function fetchBatterProjections() {
  console.log("[Proj] Fetching Steamer batter projections from FanGraphs...");
  const data = await fetchJson(FANGRAPHS_BATTER_URL);
  const byMlbId = new Map();
  const byName = new Map();

  for (const row of data ?? []) {
    const proj = {
      pa: parseNumber(row.PA),
      h: parseNumber(row.H),
      r: parseNumber(row.R),
      hr: parseNumber(row.HR),
      rbi: parseNumber(row.RBI),
      sb: parseNumber(row.SB),
      avg: parseNumber(row.AVG),
      obp: parseNumber(row.OBP),
      slg: parseNumber(row.SLG),
      ops: parseNumber(row.OPS),
    };
    if (row.mlbamid) {
      byMlbId.set(Number(row.mlbamid), proj);
    }
    if (row.PlayerName) {
      byName.set(String(row.PlayerName).toLowerCase(), proj);
    }
  }

  return { byMlbId, byName };
}

/**
 * Fetch Steamer pitcher projections from FanGraphs.
 * Returns a Map keyed by mlbamid → projection object, with a name fallback map.
 */
async function fetchPitcherProjections() {
  console.log("[Proj] Fetching Steamer pitcher projections from FanGraphs...");
  const data = await fetchJson(FANGRAPHS_PITCHER_URL);
  const byMlbId = new Map();
  const byName = new Map();

  for (const row of data ?? []) {
    const bf = parseNumber(row.BF);
    const so = parseNumber(row.SO);
    const bb = parseNumber(row.BB);
    const sv = parseNumber(row.SV);
    const hld = parseNumber(row.HLD);
    const proj = {
      pa: bf,
      ip: parseNumber(row.IP),
      k: so,
      kpct: bf > 0 ? so / bf : 0,
      bbpct: bf > 0 ? bb / bf : 0,
      era: parseNumber(row.ERA, 4.5),
      whip: parseNumber(row.WHIP, 1.3),
      qs: parseNumber(row.QS),
      svhd: sv + hld,
    };
    if (row.mlbamid) {
      byMlbId.set(Number(row.mlbamid), proj);
    }
    if (row.PlayerName) {
      byName.set(String(row.PlayerName).toLowerCase(), proj);
    }
  }

  return { byMlbId, byName };
}

/**
 * Main script
 */
async function main() {
  console.log("[Proj] Starting projection fetch...");
  const startTime = Date.now();

  // Read existing draft data
  if (!fs.existsSync(DRAFT_DATA_PATH)) {
    console.error(
      `[Proj] Error: ${DRAFT_DATA_PATH} not found. Run build.js first.`,
    );
    process.exit(1);
  }
  const draftData = JSON.parse(fs.readFileSync(DRAFT_DATA_PATH, "utf8"));

  // Attempt to fetch projections — if it fails, write file unchanged and exit
  let batterProj = null;
  let pitcherProj = null;

  try {
    [batterProj, pitcherProj] = await Promise.all([
      fetchBatterProjections(),
      fetchPitcherProjections(),
    ]);
  } catch (err) {
    console.error(
      `[Proj] Error: failed to fetch FanGraphs projections: ${err.message}`,
    );
    console.error("[Proj] draft-data.json left unchanged (projections not updated).");
    process.exit(1);
  }

  let matchedCount = 0;
  let nameMatchCount = 0;

  const updatedPlayers = draftData.players.map((player) => {
    const isBatter = player.type === "batter";
    const projMaps = isBatter ? batterProj : pitcherProj;

    let projStats = null;

    // Try matching by mlbamid first
    if (player.mlbId != null) {
      projStats = projMaps.byMlbId.get(Number(player.mlbId)) ?? null;
    }

    // Fall back to name match
    if (!projStats && player.name) {
      const nameLower = player.name.toLowerCase();
      projStats = projMaps.byName.get(nameLower) ?? null;
      if (projStats) nameMatchCount++;
    }

    if (!projStats) return player;

    matchedCount++;
    const projections = isBatter
      ? { batting: projStats, source: "Steamer" }
      : { pitching: projStats, source: "Steamer" };

    return { ...player, projections };
  });

  draftData.players = updatedPlayers;
  fs.writeFileSync(DRAFT_DATA_PATH, JSON.stringify(draftData, null, 2));

  const elapsed = Date.now() - startTime;
  console.log(`[Proj] ✅ Projections complete! (${elapsed}ms)`);
  console.log(
    `[Proj] Matched ${matchedCount} players (${nameMatchCount} by name fallback)`,
  );
  console.log(`[Proj] Saved: ${DRAFT_DATA_PATH}`);
}

main().catch((err) => {
  console.error("[Proj] Fatal error:", err);
  process.exit(1);
});
