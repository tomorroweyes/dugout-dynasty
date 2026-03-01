/**
 * Sim Harness - Report Formatter
 *
 * Formats simulation results into readable tables.
 * Designed to be easy to read in terminal output.
 */

import type { AggregateStats } from "./simRunner";
import type { ArchetypeName } from "./teamFactory";
import type { FlowMetrics } from "./flowAnalyzer";
import { ARCHETYPES } from "./teamFactory";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const dec = (n: number, places = 2) => n.toFixed(places);
const col = (s: string | number, w: number) => String(s).padEnd(w);

// ── Single Matchup Report ─────────────────────────────────────────────────

export function printMatchupReport(
  homeArchetype: ArchetypeName,
  awayArchetype: ArchetypeName,
  stats: AggregateStats
): void {
  const homeDef = ARCHETYPES[homeArchetype];
  const awayDef = ARCHETYPES[awayArchetype];
  const homeWinPct = stats.homeWins / stats.games;
  const awayWinPct = stats.awayWins / stats.games;

  console.log(`\n${"─".repeat(60)}`);
  console.log(
    `  ${homeDef.emoji} ${homeDef.label}  vs  ${awayDef.emoji} ${awayDef.label}  (${stats.games} games)`
  );
  console.log(`${"─".repeat(60)}`);

  console.log(`\n  Win Rate:   ${col(pct(homeWinPct), 12)} ${pct(awayWinPct)}`);
  console.log(`  Avg Runs:   ${col(dec(stats.avgHomeRuns), 12)} ${dec(stats.avgAwayRuns)}`);
  console.log(`  Run Diff:   ${dec(stats.avgRunDiff, 2)} (home perspective)`);
  console.log(`  Avg Inn:    ${dec(stats.avgInnings, 1)}`);

  console.log(`\n  Rate Stats    HOME          AWAY`);
  console.log(`  K%:           ${col(pct(stats.homeKRate), 14)}${pct(stats.awayKRate)}`);
  console.log(`  BB%:          ${col(pct(stats.homeBBRate), 14)}${pct(stats.awayBBRate)}`);
  console.log(`  HR/AB:        ${col(pct(stats.homeHRRate), 14)}${pct(stats.awayHRRate)}`);
  console.log(`  AVG:          ${col(dec(stats.homeAvg, 3), 14)}${dec(stats.awayAvg, 3)}`);

  const ap = stats.approachPct;
  const sp = stats.strategyPct;
  console.log(`\n  Approach Dist (all at-bats):`);
  console.log(`  💥 Power:   ${pct(ap.power)}  🎯 Contact: ${pct(ap.contact)}  👁 Patient: ${pct(ap.patient)}`);

  console.log(`\n  Strategy Dist (all pitches):`);
  console.log(`  🔥 Challenge: ${pct(sp.challenge)}  🌊 Finesse: ${pct(sp.finesse)}  🎨 Paint: ${pct(sp.paint)}`);

  const op = stats.outcomePct;
  const outcomes = Object.entries(op).sort(([, a], [, b]) => b - a);
  console.log(`\n  Outcome Dist:`);
  for (const [k, v] of outcomes) {
    console.log(`  ${col(k, 12)} ${pct(v)}`);
  }
}

// ── Score Distribution ────────────────────────────────────────────────────

export function printScoreDistribution(stats: AggregateStats, label = ""): void {
  const games = stats.rawGames;
  const maxRuns = Math.max(...games.map((g) => Math.max(g.homeRuns, g.awayRuns)));
  const bins: number[] = new Array(Math.min(maxRuns + 1, 15)).fill(0);

  for (const g of games) {
    const total = g.homeRuns + g.awayRuns;
    const bin = Math.min(total, bins.length - 1);
    bins[bin]++;
  }

  console.log(`\n  Score Distribution ${label}:`);
  for (let i = 0; i < bins.length; i++) {
    const pctVal = bins[i] / games.length;
    const bar = "█".repeat(Math.round(pctVal * 40));
    console.log(`  ${col(i + "R", 4)} ${bar} ${pct(pctVal)}`);
  }
}

// ── Matchup Matrix ─────────────────────────────────────────────────────────

export function printMatchupMatrix(
  archetypes: ArchetypeName[],
  matrix: Map<string, AggregateStats>
): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  WIN RATE MATRIX (home team row vs away team column)`);
  console.log(`${"═".repeat(70)}`);

  // Header
  const colW = 10;
  let header = col("", 12);
  for (const a of archetypes) {
    header += col(ARCHETYPES[a].label, colW);
  }
  console.log(`\n  ${header}`);
  console.log(`  ${"─".repeat(8 + archetypes.length * colW)}`);

  for (const homeArch of archetypes) {
    let row = col(ARCHETYPES[homeArch].label, 12);
    for (const awayArch of archetypes) {
      if (homeArch === awayArch) {
        row += col("  —  ", colW);
      } else {
        const key = `${homeArch}_vs_${awayArch}`;
        const stats = matrix.get(key);
        if (stats) {
          const winRate = stats.homeWins / stats.games;
          const str = pct(winRate);
          row += col(str, colW);
        } else {
          row += col("n/a", colW);
        }
      }
    }
    console.log(`  ${row}`);
  }

  console.log(`\n  Rows = Home team. Columns = Away team. Value = Home win %.`);
  console.log(`  50% = even matchup. >55% = clear advantage.`);
}

// ── Archetype Summary ─────────────────────────────────────────────────────

export function printArchetypeSummary(
  archetypes: ArchetypeName[],
  vsBaseline: Map<ArchetypeName, AggregateStats>
): void {
  const baselineName: ArchetypeName = "BALANCED";

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ARCHETYPE SUMMARY (each vs BALANCED baseline, 1000 games)`);
  console.log(`${"═".repeat(70)}`);
  console.log(
    `\n  ${col("Archetype", 14)} ${col("Win%", 8)} ${col("R/G", 8)} ${col("K%", 8)} ${col("BB%", 8)} ${col("HR/AB", 8)} ${col("AVG", 8)}`
  );
  console.log(`  ${"─".repeat(62)}`);

  for (const arch of archetypes) {
    if (arch === baselineName) continue;
    const stats = vsBaseline.get(arch);
    if (!stats) continue;

    const winPct = stats.homeWins / stats.games;
    const def = ARCHETYPES[arch];

    console.log(
      `  ${col(def.emoji + " " + def.label, 14)} ` +
        `${col(pct(winPct), 8)} ` +
        `${col(dec(stats.avgHomeRuns), 8)} ` +
        `${col(pct(stats.homeKRate), 8)} ` +
        `${col(pct(stats.homeBBRate), 8)} ` +
        `${col(pct(stats.homeHRRate), 8)} ` +
        `${col(dec(stats.homeAvg, 3), 8)}`
    );
  }
}

// ── Header / Footer ──────────────────────────────────────────────────────

export function printHeader(games: number, label = "DUGOUT DYNASTY SIM HARNESS"): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  🎮 ${label}`);
  console.log(`  ${games} games per matchup | ${new Date().toISOString()}`);
  console.log(`${"═".repeat(70)}`);
}

export function printFlowReport(_stats: AggregateStats, flow: FlowMetrics, label = ""): void {
  const f = flow;
  console.log(`\n  Game Flow Analysis ${label}:`);
  console.log(`  ${"─".repeat(60)}`);
  console.log(`  Pacing:`);
  console.log(`    Avg Runs/Side: ${dec(f.avgRunsPerSide, 1)}  (target: 3-5)`);
  console.log(`    Avg Inning Pairs: ${dec(f.avgGameLength, 1)}  (target: 8-10)`);
  console.log(`    Avg ABs/Game: ${Math.floor(f.avgABsPerGame)}  (target: 50-70)`);

  console.log(`\n  Variance & Excitement:`);
  console.log(`    Avg Lead Changes: ${dec(f.avgLeadChanges, 1)}  (target: 1.5-3)`);
  console.log(`    One-Run Games: ${pct(f.oneRunGameRate)}  (target: 15-25%)`);
  console.log(`    Blowout Rate (>5R): ${pct(f.blowoutRate)}  (target: <20%)`);
  console.log(`    Walk-Offs: ${pct(f.walkOffRate)}  (target: 2-5%)`);
  console.log(`    Extra Innings: ${pct(f.extraInningRate)}  (target: 2-5%)`);
  console.log(`    Clutch Moments: ${pct(f.clutchMomentRate)}  (target: 20-35%)`);

  console.log(`\n  🎯 FUN SCORE: ${Math.floor(f.funScore)}/100`);
  if (f.funScore >= 70) console.log(`     ✅ Likely feels exciting and engaging`);
  else if (f.funScore >= 55) console.log(`     ⚠️  Decent but could be more fun`);
  else console.log(`     ❌ Might feel slow or one-sided`);

  console.log(`\n  🎭 DRAMA SCORE: ${Math.floor(f.dramaScore)}/100`);
  console.log(`     Components: lead changes (×inning weight, cap 40) + comeback (20) + clutch rate (30) + cliffhanger 9th+ (15)`);
  if (f.dramaScore >= 55) console.log(`     ✅ Strong narrative shape — games tell a story`);
  else if (f.dramaScore >= 35) console.log(`     ⚠️  Moderate drama — some memorable moments`);
  else console.log(`     ❌ Low drama — games tend to be flat or one-sided`);
}

export function printFooter(): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  Done. Tweak ARCHETYPES in src/sim/teamFactory.ts and re-run.`);
  console.log(`  npm run sim        → quick (100 games)`);
  console.log(`  npm run sim:full   → thorough (1000 games)`);
  console.log(`${"═".repeat(70)}\n`);
}
