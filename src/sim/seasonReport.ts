/**
 * Season Report Formatter
 *
 * Formats season simulation results into readable terminal output.
 * Mirrors the style of report.ts for consistency.
 */

import type { SeasonResult, SeasonHookMetrics } from "./seasonSimulator";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const dec = (n: number, places = 2) => n.toFixed(places);
const col = (s: string | number, w: number) => String(s).padEnd(w);
const rpad = (s: string | number, w: number) => String(s).padStart(w);

// ── Standings Table ───────────────────────────────────────────────────────

export function printSeasonStandings(result: SeasonResult): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  FINAL STANDINGS`);
  console.log(`${"─".repeat(70)}`);
  console.log(
    `  ${"TEAM".padEnd(14)} ${"W".padStart(4)} ${"L".padStart(4)} ${"W%".padStart(6)} ${"RF".padStart(5)} ${"RA".padStart(5)} ${"DIFF".padStart(6)}  STREAK`
  );
  console.log(`${"─".repeat(70)}`);

  for (let i = 0; i < result.finalStandings.length; i++) {
    const t = result.finalStandings[i];
    const diff = t.runsFor - t.runsAgainst;
    const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
    const streakStr =
      t.currentStreak > 0
        ? `W${t.currentStreak}`
        : t.currentStreak < 0
        ? `L${Math.abs(t.currentStreak)}`
        : "-";
    const playoffMarker = t.madePlayoffs ? "✓" : " ";

    console.log(
      `  ${playoffMarker} ${col(`${i + 1}. ${t.name}`, 14)} ` +
        `${rpad(t.wins, 4)} ${rpad(t.losses, 4)} ` +
        `${rpad(dec(t.winPct, 3), 6)} ` +
        `${rpad(t.runsFor, 5)} ${rpad(t.runsAgainst, 5)} ` +
        `${rpad(diffStr, 6)}  ${streakStr}`
    );
  }
  console.log(`${"─".repeat(70)}`);
  console.log(`  ✓ = Playoff qualifier`);
}

// ── Streak Summary ────────────────────────────────────────────────────────

export function printSeasonStreaks(result: SeasonResult): void {
  const sorted = [...result.teams].sort((a, b) => b.maxWinStreak - a.maxWinStreak);

  console.log(`\n  SEASON STREAKS`);
  console.log(`${"─".repeat(50)}`);
  console.log(`  ${"TEAM".padEnd(14)} ${"MAX WIN STK".padStart(12)} ${"MAX LOSS STK".padStart(13)}`);
  console.log(`${"─".repeat(50)}`);
  for (const t of sorted) {
    const winStreakStr = t.maxWinStreak >= 5 ? `${t.maxWinStreak} 🔥` : `${t.maxWinStreak}`;
    console.log(
      `  ${col(t.name, 14)} ${rpad(winStreakStr, 12)} ${rpad(t.maxLossStreak, 13)}`
    );
  }
}

// ── Hook Metrics ──────────────────────────────────────────────────────────

export function printSeasonHookMetrics(metrics: SeasonHookMetrics): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  SEASON HOOK METRICS`);
  console.log(`${"─".repeat(70)}`);

  const mustPlay = metrics.hasMustPlayMoment ? "✅ YES" : "❌ NO";
  console.log(`  Must-Play Season:          ${mustPlay}`);
  console.log(`  Playoff Race Tightness:    ${pct(metrics.playoffRaceTightness)}`);
  console.log(`  Streak Frequency (5+ W):   ${pct(metrics.streakFrequency)}`);
  console.log(`  Comeback Rate:             ${pct(metrics.comebackRate)}`);
  console.log(`  Avg Drama Score:           ${dec(metrics.avgDramaScore, 1)}/100`);
  console.log(`  Avg Late Drama Score:      ${dec(metrics.avgLateDramaScore, 1)}/100`);
  console.log(`  Total Games:               ${metrics.totalGames}`);

  if (metrics.narrativeMoments.length > 0) {
    console.log(`\n  SEASON STORYLINES:`);
    for (const moment of metrics.narrativeMoments) {
      console.log(`  📖 ${moment}`);
    }
  }
}

// ── Multi-Season Aggregate ────────────────────────────────────────────────

export function printMultiSeasonReport(multiResult: {
  seasons: SeasonResult[];
  mustPlayRate: number;
  avgPlayoffRaceTightness: number;
  avgStreakFrequency: number;
  avgComebackRate: number;
  avgDramaScore: number;
}): void {
  const n = multiResult.seasons.length;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  MULTI-SEASON SUMMARY (${n} seasons)`);
  console.log(`${"─".repeat(70)}`);

  const target = 0.8;
  const mustPlayFlag =
    multiResult.mustPlayRate >= target ? "✅" : "⚠️ ";
  console.log(
    `  Must-Play Rate:            ${mustPlayFlag} ${pct(multiResult.mustPlayRate)} ` +
      `(target: ${pct(target)})`
  );
  console.log(
    `  Avg Playoff Race Tightness: ${pct(multiResult.avgPlayoffRaceTightness)}`
  );
  console.log(
    `  Avg Streak Frequency:      ${pct(multiResult.avgStreakFrequency)}`
  );
  console.log(`  Avg Comeback Rate:         ${pct(multiResult.avgComebackRate)}`);
  console.log(`  Avg Drama Score:           ${dec(multiResult.avgDramaScore, 1)}/100`);

  // Per-season verdict breakdown
  const mustPlayCount = multiResult.seasons.filter(
    (s) => s.hookMetrics.hasMustPlayMoment
  ).length;
  const notCount = n - mustPlayCount;
  console.log(`\n  Season Quality Breakdown:`);
  console.log(`  ✅ Must-play: ${mustPlayCount}/${n} seasons`);
  console.log(`  ❌ Flat:      ${notCount}/${n} seasons`);

  if (multiResult.mustPlayRate < target) {
    console.log(
      `\n  ⚠️  Below ${pct(target)} target — consider tuning playoff spots or team archetypes.`
    );
  } else {
    console.log(`\n  ✅ Season arc generator producing engaging seasons.`);
  }

  console.log(`${"─".repeat(70)}`);
}

// ── Full Season Report (single season) ───────────────────────────────────

export function printSeasonReport(result: SeasonResult): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  SEASON ARC REPORT`);
  console.log(`  ${result.hookMetrics.totalGames} games · ${result.teams.length} teams`);

  printSeasonStandings(result);
  printSeasonStreaks(result);
  printSeasonHookMetrics(result.hookMetrics);

  console.log(`\n${"═".repeat(70)}\n`);
}
