/**
 * Dugout Dynasty - Headless Simulation Harness
 *
 * Runs the full game engine without any UI.
 * Use this to balance stats, test archetypes, and probe emergent behavior.
 *
 * USAGE:
 *   npm run sim            → 100 games (fast, ~3 seconds)
 *   npm run sim:full       → 1000 games (~25 seconds)
 *   GAMES=500 npm run sim  → custom count
 *
 * TWEAKING:
 *   - Archetype stats:   src/sim/teamFactory.ts → ARCHETYPES
 *   - Constants:         src/engine/constants.ts
 *   - Approach config:   src/engine/approachConfig.ts
 *   - Run a specific matchup only by changing SCENARIOS below
 *
 * OUTPUT:
 *   - Win rates, avg runs, K/BB/HR rates, AVG
 *   - Approach distribution (power/contact/patient)
 *   - Strategy distribution (challenge/finesse/paint)
 *   - Outcome distribution (HR/single/double/K/BB/etc)
 *   - Head-to-head matrix (all archetype combos)
 */

import { describe, it } from "vitest";
import { buildTeam, ARCHETYPES, type ArchetypeName } from "./teamFactory";
import { runSimulation, type AggregateStats } from "./simRunner";
import {
  printHeader,
  printMatchupReport,
  printScoreDistribution,
  printMatchupMatrix,
  printArchetypeSummary,
  printFooter,
} from "./report";

// ── Config ──────────────────────────────────────────────────────────────────

const GAMES = parseInt(process.env.GAMES ?? "100");

/**
 * Which archetypes to include in the matrix run.
 * Comment out any you don't need for faster iteration.
 */
const ARCHETYPES_TO_RUN: ArchetypeName[] = [
  "POWER",
  "CONTACT",
  "BALANCED",
  "SPEED",
  "PITCHING",
  "SLUGFEST",
];

/**
 * Specific 1-on-1 matchups to report in detail.
 * Add any pairing you want deep analysis on.
 */
const SPOTLIGHT_MATCHUPS: [ArchetypeName, ArchetypeName][] = [
  ["POWER", "CONTACT"],
  ["POWER", "PITCHING"],
  ["SLUGFEST", "PITCHING"],
  ["SPEED", "POWER"],
  ["BALANCED", "CONTACT"],
];

// ── Main Harness ─────────────────────────────────────────────────────────────

describe("Game Balance Simulation Harness", () => {
  it(
    `runs ${GAMES} games per matchup and reports balance stats`,
    { timeout: 300_000 }, // 5 min max
    () => {
      printHeader(GAMES);

      const matrix = new Map<string, AggregateStats>();
      const vsBaseline = new Map<ArchetypeName, AggregateStats>();

      // ── Phase 1: Build all teams ───────────────────────────────────────
      console.log(`\n  Building ${ARCHETYPES_TO_RUN.length} archetype teams...`);
      const teams = new Map<ArchetypeName, ReturnType<typeof buildTeam>>();
      for (const arch of ARCHETYPES_TO_RUN) {
        teams.set(arch, buildTeam(arch));
        console.log(`  ✓ ${ARCHETYPES[arch].emoji} ${ARCHETYPES[arch].label}`);
      }

      // ── Phase 2: Run all matchups ─────────────────────────────────────
      console.log(`\n  Running ${GAMES} games per matchup...`);
      const pairs: [ArchetypeName, ArchetypeName][] = [];
      for (const home of ARCHETYPES_TO_RUN) {
        for (const away of ARCHETYPES_TO_RUN) {
          if (home !== away) pairs.push([home, away]);
        }
      }

      let done = 0;
      for (const [home, away] of pairs) {
        const homeTeam = teams.get(home)!;
        const awayTeam = teams.get(away)!;
        const stats = runSimulation(homeTeam, awayTeam, GAMES);
        const key = `${home}_vs_${away}`;
        matrix.set(key, stats);

        // Track vs-BALANCED for summary
        if (away === "BALANCED") vsBaseline.set(home, stats);
        done++;
        if (done % 5 === 0) {
          console.log(`  ... ${done}/${pairs.length} matchups complete`);
        }
      }

      // ── Phase 3: Print matrix ──────────────────────────────────────────
      printMatchupMatrix(ARCHETYPES_TO_RUN, matrix);

      // ── Phase 4: Print archetype summary ──────────────────────────────
      printArchetypeSummary(ARCHETYPES_TO_RUN, vsBaseline);

      // ── Phase 5: Spotlight matchups ────────────────────────────────────
      console.log(`\n${"═".repeat(70)}`);
      console.log(`  SPOTLIGHT MATCHUPS (detailed breakdowns)`);

      for (const [home, away] of SPOTLIGHT_MATCHUPS) {
        if (!ARCHETYPES_TO_RUN.includes(home) || !ARCHETYPES_TO_RUN.includes(away)) continue;
        const key = `${home}_vs_${away}`;
        const stats = matrix.get(key);
        if (!stats) continue;

        printMatchupReport(home, away, stats);

        if (GAMES >= 200) {
          printScoreDistribution(stats, `(${home} vs ${away})`);
        }
      }

      // ── Phase 6: Balance flags ─────────────────────────────────────────
      console.log(`\n${"═".repeat(70)}`);
      console.log(`  BALANCE FLAGS (potential issues)`);
      console.log(`${"─".repeat(70)}`);

      let flags = 0;
      for (const [key, stats] of matrix) {
        const [homeStr, , awayStr] = key.split("_");
        const home = homeStr as ArchetypeName;
        const away = awayStr as ArchetypeName;
        const winPct = stats.homeWins / stats.games;

        // Flag any matchup more one-sided than 65/35
        if (winPct > 0.65) {
          const homeLabel = ARCHETYPES[home].label;
          const awayLabel = ARCHETYPES[away].label;
          console.log(
            `  ⚠️  ${homeLabel} beats ${awayLabel} ${(winPct * 100).toFixed(1)}% → may need rebalancing`
          );
          flags++;
        }
      }

      // Flag extreme K rates
      for (const [key, stats] of matrix) {
        const [homeStr] = key.split("_");
        const home = homeStr as ArchetypeName;
        if (stats.homeKRate > 0.35) {
          console.log(
            `  ⚠️  ${ARCHETYPES[home].label} K rate ${(stats.homeKRate * 100).toFixed(1)}% → strikeouts too high`
          );
          flags++;
        }
        if (stats.avgHomeRuns < 1.5 || stats.avgHomeRuns > 8) {
          console.log(
            `  ⚠️  ${ARCHETYPES[home].label} avg runs ${stats.avgHomeRuns.toFixed(1)} → outside healthy range (2-7)`
          );
          flags++;
        }
      }

      if (flags === 0) {
        console.log(`  ✅ No major balance issues detected.`);
      }

      // ── Done ───────────────────────────────────────────────────────────
      printFooter();
    }
  );
});
