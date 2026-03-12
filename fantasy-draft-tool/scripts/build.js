/**
 * Data Build Script
 * Runs nightly (4 AM UTC) to fetch fresh stats, injury data, and generate draft-data.json
 * 
 * Usage: node scripts/build.js
 * Outputs: public/data/draft-data.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '../public/data');

// Ensure output directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

/**
 * Fetch 2025 batting stats from Baseball Savant
 */
async function fetchBattingStats() {
  console.log('[Data] Fetching batting stats from Baseball Savant...');
  try {
    const res = await fetch(
      'https://baseballsavant.mlb.com/leaderboard/custom?year=2025&type=batter&filter=&sort=on_base_plus_slg&sortDir=desc&min=250&selections=pa,hit,r,home_run,rbi,stolen_base,batting_average,on_base_percent,slg_percent,on_base_plus_slg&chart=false&csv=true'
    );
    const csv = await res.text();
    const lines = csv.trim().split('\n');
    
    const players = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSV(lines[i]);
      if (row.length < 13) continue;

      const name = row[0].trim();
      const pa = parseInt(row[3]) || 0;
      if (pa < 250) continue;

      players.push({
        id: `bat-${row[1]}`,
        name,
        mlbId: parseInt(row[1]),
        type: 'batter',
        position: 'OF', // TODO: map actual position
        tier: calculateBatterTier(parseFloat(row[12]) || 0),
        batting: {
          pa,
          h: parseInt(row[4]) || 0,
          r: parseInt(row[5]) || 0,
          hr: parseInt(row[6]) || 0,
          rbi: parseInt(row[7]) || 0,
          sb: parseInt(row[8]) || 0,
          avg: parseFloat(row[9]) || 0,
          obp: parseFloat(row[10]) || 0,
          slg: parseFloat(row[11]) || 0,
          ops: parseFloat(row[12]) || 0,
        },
        injured: false,
        lastUpdated: Date.now(),
      });
    }

    return players;
  } catch (err) {
    console.error('[Data] Error fetching batting stats:', err);
    return [];
  }
}

/**
 * Fetch 2025 pitching stats from Baseball Savant
 */
async function fetchPitchingStats() {
  console.log('[Data] Fetching pitching stats from Baseball Savant...');
  try {
    const res = await fetch(
      'https://baseballsavant.mlb.com/leaderboard/custom?year=2025&type=pitcher&filter=&sort=4&sortDir=desc&min=100&selections=pa,strikeout,bb,earned_run_avg,whip,k_percent&chart=false&csv=true'
    );
    const csv = await res.text();
    const lines = csv.trim().split('\n');

    const players = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSV(lines[i]);
      if (row.length < 9) continue;

      const name = row[0].trim();
      const pa = parseInt(row[3]) || 0;
      if (pa < 100) continue;

      const k = parseInt(row[4]) || 0;
      const kpct = parseFloat(row[8]) || 0;
      
      players.push({
        id: `pit-${row[1]}`,
        name,
        mlbId: parseInt(row[1]),
        type: 'pitcher',
        position: 'SP', // TODO: infer SP vs RP from innings
        tier: calculatePitcherTier(k, pa),
        pitching: {
          pa,
          k,
          kpct,
          bbpct: 0, // would need to fetch separately
          era: parseFloat(row[6]) || 4.5,
          whip: parseFloat(row[7]) || 1.3,
        },
        injured: false,
        lastUpdated: Date.now(),
      });
    }

    return players;
  } catch (err) {
    console.error('[Data] Error fetching pitching stats:', err);
    return [];
  }
}

/**
 * Helper: parse CSV line (handles quoted fields)
 */
function parseCSV(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let c of line) {
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Tier batters by OPS
 */
function calculateBatterTier(ops) {
  if (ops >= 0.950) return 'ELITE';
  if (ops >= 0.900) return '1';
  if (ops >= 0.850) return '2';
  if (ops >= 0.800) return '3';
  if (ops >= 0.750) return '4';
  return '5';
}

/**
 * Tier pitchers by K count
 */
function calculatePitcherTier(k, pa) {
  if (k >= 200) return 'ELITE';
  if (k >= 170) return '1';
  if (k >= 140) return '2';
  if (k >= 110) return '3';
  if (k >= 80) return '4';
  return '5';
}

/**
 * Your league configuration
 */
const LEAGUE_CONFIG = {
  name: '2025 EELite League',
  teams: 8,
  format: 'H2H',
  scoringType: 'most-categories',
  roster: {
    batting: '1C, 1B, 2B, 3B, SS, 3OF, 1DH, 2UTIL (9 starters)',
    pitching: '6SP, 3RP (9 starters)',
    bench: 3,
    il: 3,
  },
  scoringCategories: {
    batting: ['H', 'R', 'HR', 'RBI', 'SB', 'OPS'],
    pitching: ['K', 'QS', 'ERA', 'WHIP', 'SVHD'],
  },
  draftInfo: {
    pickNumber: 5,
    totalPicks: 184, // 8 teams * 23 rounds
    snakeDraft: true,
  },
};

/**
 * Build and save final data
 */
async function build() {
  console.log('[Data] Starting data build...');
  const startTime = Date.now();

  const batters = await fetchBattingStats();
  const pitchers = await fetchPitchingStats();
  const allPlayers = [...batters, ...pitchers];

  const draftData = {
    league: LEAGUE_CONFIG,
    players: allPlayers,
    fetchedAt: Date.now(),
    dataVersion: '1.0.0',
  };

  // Write to file
  const outPath = path.join(PUBLIC_DIR, 'draft-data.json');
  fs.writeFileSync(outPath, JSON.stringify(draftData, null, 2));

  const elapsed = Date.now() - startTime;
  console.log(`[Data] ✅ Build complete! (${elapsed}ms)`);
  console.log(`[Data] Saved: ${outPath}`);
  console.log(`[Data] Players: ${allPlayers.length} (${batters.length} batters, ${pitchers.length} pitchers)`);
}

build().catch(err => {
  console.error('[Data] Fatal error:', err);
  process.exit(1);
});
