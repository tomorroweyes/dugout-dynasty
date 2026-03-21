/**
 * fetch-injuries.js
 *
 * Fetches current MLB IL status from the MLB Stats API transactions feed
 * and writes public/data/injuries.json.
 *
 * Patches this into draft-data.json players via mlbId.
 *
 * Usage: node scripts/fetch-injuries.js
 *
 * Env vars (all optional):
 *   MLB_SEASON    - season year (default: current year)
 *   LOOKBACK_DAYS - how many days of transactions to scan (default: 90)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public/data");
const DRAFT_DATA_PATH = path.join(PUBLIC_DIR, "draft-data.json");
const OUTPUT_PATH = path.join(PUBLIC_DIR, "injuries.json");

const SEASON = Number(process.env.MLB_SEASON ?? new Date().getFullYear());
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS ?? 90);

// Transaction type codes that represent IL placement/activation
const IL_PLACED_CODES = new Set(["SC", "DFA", "RL"]);
const IL_PLACED_KEYWORDS = ["injured list", "il", "disabled list"];
const IL_CLEARED_KEYWORDS = ["activated", "reinstated", "returned"];

const IL_TYPE_PATTERN = /(\d+)-day/i;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchTransactions(startDate, endDate) {
  const url = `https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate=${startDate}&endDate=${endDate}&limit=2000`;
  const data = await fetchJson(url);
  return data.transactions ?? [];
}

function classifyTransaction(tx) {
  const desc = (tx.description ?? "").toLowerCase();

  const isPlaced = IL_PLACED_KEYWORDS.some((kw) => desc.includes(kw)) &&
    desc.includes("placed");
  const isCleared = IL_CLEARED_KEYWORDS.some((kw) => desc.includes(kw)) &&
    (desc.includes("injured list") || desc.includes("il") || desc.includes("disabled list"));

  if (!isPlaced && !isCleared) return null;

  const ilMatch = desc.match(IL_TYPE_PATTERN);
  const ilDays = ilMatch ? Number(ilMatch[1]) : null;

  return {
    type: isPlaced ? "placed" : "cleared",
    ilDays,
    description: tx.description,
  };
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);

  console.log(`[MLB] Fetching transactions ${dateStr(startDate)} → ${dateStr(endDate)} (season ${SEASON})...`);

  const transactions = await fetchTransactions(dateStr(startDate), dateStr(endDate));
  console.log(`[MLB] Raw transactions: ${transactions.length}`);

  // Build per-player IL history, most recent event wins
  // key: mlbId → { status, ilDays, description, date }
  const playerEvents = new Map();

  for (const tx of transactions) {
    const classified = classifyTransaction(tx);
    if (!classified) continue;

    const playerId = tx.person?.id;
    const playerName = tx.person?.fullName;
    if (!playerId) continue;

    const txDate = tx.effectiveDate ?? tx.date;
    const existing = playerEvents.get(playerId);

    // Keep the most recent event
    if (!existing || txDate >= existing.date) {
      playerEvents.set(playerId, {
        mlbId: playerId,
        name: playerName,
        status: classified.type === "placed" ? "OUT" : "ACTIVE",
        ilDays: classified.ilDays,
        description: classified.description,
        date: txDate,
      });
    }
  }

  // Filter to only players currently on IL (most recent event = placed)
  const currentlyInjured = [...playerEvents.values()].filter(
    (e) => e.status === "OUT",
  );

  console.log(`[MLB] Currently on IL: ${currentlyInjured.length}`);

  const payload = {
    fetchedAt: Date.now(),
    season: SEASON,
    source: "mlb-statsapi-transactions",
    players: currentlyInjured,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`[MLB] Saved ${OUTPUT_PATH}`);

  // Patch draft-data.json
  if (!fs.existsSync(DRAFT_DATA_PATH)) {
    console.log("[MLB] draft-data.json not found, skipping patch.");
    return;
  }

  const draftData = JSON.parse(fs.readFileSync(DRAFT_DATA_PATH, "utf8"));
  const injuryById = new Map(currentlyInjured.map((p) => [p.mlbId, p]));

  let patched = 0;
  let cleared = 0;

  draftData.players = draftData.players.map((player) => {
    if (!player.mlbId) return player;

    const injury = injuryById.get(player.mlbId);

    if (injury) {
      // Player is on IL — update their status
      const ilLabel = injury.ilDays ? `${injury.ilDays}-DAY IL` : "OUT";
      const updated = {
        ...player,
        injured: true,
        injuryStatus: ilLabel,
        notes: [
          ...(player.notes ?? []).filter((n) => !n.startsWith("MLB IL:")),
          `MLB IL: ${injury.description}`,
        ],
      };
      patched++;
      return updated;
    }

    // Player was previously marked injured by this script but is now cleared
    if (
      player.injured &&
      player.notes?.some((n) => n.startsWith("MLB IL:"))
    ) {
      const updated = {
        ...player,
        injured: false,
        injuryStatus: undefined,
        notes: (player.notes ?? []).filter((n) => !n.startsWith("MLB IL:")),
      };
      cleared++;
      return updated;
    }

    return player;
  });

  draftData.fetchedAt = Date.now();
  fs.writeFileSync(DRAFT_DATA_PATH, JSON.stringify(draftData, null, 2));
  console.log(`[MLB] Patched ${patched} players as injured, cleared ${cleared}.`);
}

main().catch((err) => {
  console.error("[MLB] Fatal:", err);
  process.exit(1);
});
