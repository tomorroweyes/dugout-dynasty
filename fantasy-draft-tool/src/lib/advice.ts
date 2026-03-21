import type { LeagueConfig, LeagueProfile, Player } from "../types";
import type {
  ContextualPlayer,
  DraftClock,
  EspnAvailabilitySignal,
} from "./data";
import { getOpenPrimarySlots, getPlayerPositions } from "./data";

export interface DraftHistoryManagerPattern {
  teamId: number;
  abbrev: string | null;
  firstSpRound: number | null;
  firstRpRound: number | null;
  pitcherFirstThreeRounds: boolean;
  earlyClass: Record<string, number>;
  runs: { class: string; startRound: number; length: number }[];
}

export interface DraftHistorySeason {
  seasonId: number;
  standings: {
    teamId: number;
    abbrev: string | null;
    wins: number | null;
    losses: number | null;
    finalStanding: number | null;
  }[];
  managerPatterns: DraftHistoryManagerPattern[];
}

export interface DraftHistory {
  fetchedAt: number;
  leagueId: number;
  seasons: DraftHistorySeason[];
}

export interface AdviceContext {
  leagueConfig: LeagueConfig;
  profile: LeagueProfile;
  clock: DraftClock;
  draftedPlayers: Player[];
  availablePlayers: ContextualPlayer[];
  topAvailable: ContextualPlayer[];
  recentTaken: { player: Player; takenAtPick: number }[];
  availabilityMap: Record<string, EspnAvailabilitySignal>;
  draftHistory: DraftHistory | null;
}

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

function isShoheiOhtani(player: Player): boolean {
  return normalizePlayerName(player.name) === "shohei ohtani";
}

function formatTierLabel(tier: import("../types").Tier): string {
  return tier === "ELITE" ? "ELITE" : `T${tier}`;
}

function classifyAvailability(
  players: ContextualPlayer[],
  availabilityMap: Record<string, EspnAvailabilitySignal>,
): { likelyGone: string[]; bubble: string[]; safer: string[] } {
  const likelyGone: string[] = [];
  const bubble: string[] = [];
  const safer: string[] = [];
  for (const entry of players.slice(0, 20)) {
    const sig = availabilityMap[entry.player.id];
    const status = sig?.status;
    if (status === "now" || status === "swing")
      likelyGone.push(entry.player.name);
    else if (status === "fragile") bubble.push(entry.player.name);
    else safer.push(entry.player.name);
  }
  return { likelyGone, bubble, safer };
}

function describeManagerPatterns(history: DraftHistory): string {
  if (history.seasons.length === 0) return "No historical data available.";

  // Merge patterns across seasons, keyed by abbrev
  const merged: Record<
    string,
    {
      abbrev: string;
      firstSpRounds: number[];
      pitcherEarlyCount: number;
      seasons: number;
      bestFinish: number;
    }
  > = {};

  for (const season of history.seasons) {
    const standingByTeam = new Map(season.standings.map((s) => [s.teamId, s]));
    for (const p of season.managerPatterns) {
      const abbrev = p.abbrev ?? `team${p.teamId}`;
      if (!merged[abbrev]) {
        merged[abbrev] = {
          abbrev,
          firstSpRounds: [],
          pitcherEarlyCount: 0,
          seasons: 0,
          bestFinish: 99,
        };
      }
      const m = merged[abbrev];
      m.seasons += 1;
      if (p.firstSpRound != null) m.firstSpRounds.push(p.firstSpRound);
      if (p.pitcherFirstThreeRounds) m.pitcherEarlyCount += 1;
      const standing = standingByTeam.get(p.teamId);
      if (
        standing?.finalStanding != null &&
        standing.finalStanding < m.bestFinish
      ) {
        m.bestFinish = standing.finalStanding;
      }
    }
  }

  const lines = Object.values(merged).map((m) => {
    const avgSp =
      m.firstSpRounds.length > 0
        ? Math.round(
            m.firstSpRounds.reduce((a, b) => a + b, 0) / m.firstSpRounds.length,
          )
        : null;
    const pitcherEarlyLabel =
      m.pitcherEarlyCount === m.seasons
        ? "always goes pitcher early (R1-3)"
        : m.pitcherEarlyCount > 0
          ? "sometimes goes pitcher early"
          : "bats-first through round 3";
    const spLabel = avgSp != null ? `avg first SP: R${avgSp}` : "no SP data";
    const finishLabel =
      m.bestFinish < 99 ? ` | best finish: #${m.bestFinish}` : "";
    return `- ${m.abbrev}: ${pitcherEarlyLabel}, ${spLabel}${finishLabel}`;
  });

  return lines.join("\n");
}

function formatPositionLabel(player: import("../types").Player): string {
  const positions = getPlayerPositions(player);
  return positions.length > 1 ? positions.join("/") : player.position;
}

function formatBattingStatLine(b: import("../types").BattingStats): string {
  const parts: string[] = [];
  if (b.pa) parts.push(`PA:${Math.round(b.pa)}`);
  if (b.h) parts.push(`H:${Math.round(b.h)}`);
  if (b.hr) parts.push(`HR:${Math.round(b.hr)}`);
  if (b.ops) parts.push(`OPS:${b.ops.toFixed(3)}`);
  if (b.sb) parts.push(`SB:${Math.round(b.sb)}`);
  if (b.r) parts.push(`R:${Math.round(b.r)}`);
  if (b.rbi) parts.push(`RBI:${Math.round(b.rbi)}`);
  return parts.join(", ");
}

function formatPitchingStatLine(p: import("../types").PitchingStats): string {
  const parts: string[] = [];
  if (p.ip) parts.push(`IP:${p.ip.toFixed(1)}`);
  if (p.era) parts.push(`ERA:${p.era.toFixed(2)}`);
  if (p.whip) parts.push(`WHIP:${p.whip.toFixed(2)}`);
  if (p.k) parts.push(`K:${Math.round(p.k)}`);
  if (p.qs) parts.push(`QS:${parseFloat(p.qs.toFixed(1))}`);
  if (p.svhd) parts.push(`SVHD:${parseFloat(p.svhd.toFixed(1))}`);
  return parts.join(", ");
}

function formatPlayerStats(player: import("../types").Player): string {
  const lines: string[] = [];

  // Current 2025 season — use separate if blocks so two-way players emit both lines
  if (player.batting) {
    const line = formatBattingStatLine(player.batting);
    if (line) lines.push(`2025: ${line}`);
  }
  if (player.pitching) {
    const line = formatPitchingStatLine(player.pitching);
    if (line) lines.push(`2025: ${line}`);
  }

  // Previous seasons in chronological order — same two-way treatment
  if (player.previousSeasons && player.previousSeasons.length > 0) {
    for (const prev of player.previousSeasons) {
      if (prev.batting) {
        const line = formatBattingStatLine(prev.batting);
        if (line) lines.push(`${prev.season}: ${line}`);
      }
      if (prev.pitching) {
        const line = formatPitchingStatLine(prev.pitching);
        if (line) lines.push(`${prev.season}: ${line}`);
      }
    }
  }

  // 2026 projections — same two-way treatment
  if (player.projections) {
    const { source } = player.projections;
    if (player.projections.batting) {
      const line = formatBattingStatLine(player.projections.batting);
      if (line) lines.push(`2026 proj (${source}): ${line}`);
    }
    if (player.projections.pitching) {
      const line = formatPitchingStatLine(player.projections.pitching);
      if (line) lines.push(`2026 proj (${source}): ${line}`);
    }
  }

  return lines.join("\n");
}

function getReplacementBaselineNote(leagueConfig: LeagueConfig): string {
  if (leagueConfig.teams <= 8) {
    return "Replacement-level baseline for this 8-team room: hitters are roughly 22 HR, .780 OPS, and low-double-digit SB; starters are roughly 170 K with ERA around 3.80 and WHIP around 1.20. Only recommend players clearly above those baselines unless you are intentionally filling speed, saves/holds, or catcher scarcity.";
  }

  if (leagueConfig.teams <= 10) {
    return "Replacement-level baseline for this room: hitters are roughly 20 HR and .760 OPS; starters are roughly 160 K with ERA around 3.95 and WHIP around 1.24. Only recommend players clearly above those baselines unless you are intentionally filling speed, saves/holds, or catcher scarcity.";
  }

  return "Replacement-level baseline for this room: hitters are roughly 18 HR and .740 OPS; starters are roughly 150 K with ERA around 4.05 and WHIP around 1.28. Only recommend players clearly above those baselines unless you are intentionally filling speed, saves/holds, or catcher scarcity.";
}

const TIER_ORDER: import("../types").Tier[] = [
  "ELITE",
  "1",
  "2",
  "3",
  "4",
  "5",
];

function tierRank(tier: import("../types").Tier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? 99 : idx;
}

function buildPositionCliffLines(
  players: ContextualPlayer[],
  currentPick: number,
  availabilityMap: Record<string, EspnAvailabilitySignal>,
  openSlots: Record<string, number>,
): string[] {
  const watchedPositions: import("../types").Position[] = [
    "SS",
    "C",
    "RP",
    "SP",
    "OF",
  ];

  return watchedPositions.flatMap((position) => {
    const positionPlayers = players.filter((entry) =>
      getPlayerPositions(entry.player).includes(position),
    );
    if (positionPlayers.length === 0) return [];

    // Find the actual best (lowest rank) tier available, not just the top-scored player's tier
    const bestTier = positionPlayers.reduce<import("../types").Tier>(
      (best, entry) =>
        tierRank(entry.player.tier) < tierRank(best) ? entry.player.tier : best,
      positionPlayers[0].player.tier,
    );

    const sameTier = positionPlayers.filter(
      (entry) => entry.player.tier === bestTier,
    );
    const names = sameTier
      .slice(0, 3)
      .map((entry) => entry.player.name)
      .join(", ");
    const lastSameTier = sameTier[sameTier.length - 1]?.player;

    // Find the next WORSE tier (higher tierRank number) among remaining players
    const nextTier = positionPlayers
      .map((entry) => entry.player.tier)
      .find((t) => tierRank(t) > tierRank(bestTier));

    // Use ESPN ADP from availabilityMap for cliff estimation if available
    const lastSig = lastSameTier ? availabilityMap[lastSameTier.id] : null;
    const estimatedCliffPick =
      lastSig?.adp != null
        ? Math.round(lastSig.adp)
        : currentPick + sameTier.length;

    const cliffNote = nextTier
      ? `then drops to ${formatTierLabel(nextTier)}`
      : "with no lower tier visible in the current pool";

    // Annotate whether the user's starter slot for this position is already filled
    const slotOpen = (openSlots[position] ?? 0) > 0;
    const slotNote = slotOpen
      ? ""
      : " ⚠ starter slot already filled — depth/UTIL only";

    return [
      `  - ${position}: best live tier is ${formatTierLabel(bestTier)} with ${sameTier.length} left (${names || "unnamed"}); expected cliff around pick ${estimatedCliffPick}, ${cliffNote}.${slotNote}`,
    ];
  });
}

function buildRunAlertLines(
  recentTaken: { player: Player; takenAtPick: number }[],
): string[] {
  const lastEight = recentTaken.slice(-8);
  if (lastEight.length === 0) return [];

  const counts = lastEight.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.player.position] = (acc[entry.player.position] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1])
    .map(([position, count]) => {
      const picks = lastEight
        .filter((entry) => entry.player.position === position)
        .map((entry) => `${entry.player.name} @ ${entry.takenAtPick}`)
        .join(", ");
      const panicLabel =
        position === "C" || position === "RP"
          ? "Panic button active: explicitly compare the next option in this run against your wait strategy before passing again."
          : "Reassess whether the remaining tier edge is worth paying now.";
      return `  - ${position} run active: ${count} of the last 8 picks (${picks}). ${panicLabel}`;
    });
}

/**
 * Returns only the 1-2 strategy pillars that actively constrain THIS pick.
 * Expired or background pillars are already enforced by the system prompt's
 * CRITICAL — STRATEGY section and ANTI-PATTERNS list, so repeating them
 * every turn is noise.
 */
function buildStrategyLines(
  profile: LeagueProfile,
  clock: DraftClock,
  openSlots: Record<string, number>,
): string | null {
  const isMiddlePhase = clock.currentRound >= 4 && clock.currentRound <= 6;
  const isPitchingPhase = clock.currentRound >= 7;
  const isLatePhase = clock.currentRound >= 10;

  const active: string[] = [];

  for (const pillar of profile.strategyPillars) {
    // Round 1 only — the 1.01 pick itself
    if (
      pillar.title === "Exploit 1.01 for category separation" &&
      clock.currentRound === 1
    ) {
      active.push(`  • ${pillar.title}: ${pillar.detail}`);
      continue;
    }

    // Middle rounds: roster-shape window
    if (pillar.title === "Build around real category leaks" && isMiddlePhase) {
      active.push(
        "  • Build around real category leaks: This is the roster-shape window. Patch missing speed, preserve OPS, and do not burn picks on empty-name value that creates a later catcher, shortstop, or outfield cliff.",
      );
      continue;
    }

    // Post-middle: shifted into active management mode
    if (
      pillar.title === "Build around real category leaks" &&
      isPitchingPhase
    ) {
      active.push(
        "  • Active roster-shape management: Prioritize hitting cliffs when they are about to break, but otherwise use picks to fix category leaks and avoid carrying dead spots into the endgame.",
      );
      continue;
    }

    // SP delay is only a constraint BEFORE the pitching phase
    if (
      pillar.title ===
        "Delay SP aggressively — target round 7+ for your first non-ace starter" &&
      !isPitchingPhase
    ) {
      active.push(`  • ${pillar.title}: ${pillar.detail}`);
      continue;
    }

    // Pitching phase active — replaces the delay rule
    if (
      pillar.title ===
        "Delay SP aggressively — target round 7+ for your first non-ace starter" &&
      isPitchingPhase
    ) {
      const openHittingCliffs = (
        ["C", "3B", "OF"] as import("../types").Position[]
      ).filter((pos) => (openSlots[pos] ?? 0) > 0);
      const cliffList =
        openHittingCliffs.length > 0 ? openHittingCliffs.join(", ") : null;
      const cliffNote = cliffList
        ? `, but prioritize filling hitting cliffs (${cliffList}) first when they are about to break`
        : " — all key hitting positions are filled";
      active.push(
        `  • Pitching phase active: We are in the SP window (R7+). Actively target high-leash SPs who stabilize ratios${cliffNote}. When an SP and a bat grade equivalently by Decision Score, prefer the SP until 5 starters are secured or the ELITE/T1 SP tier breaks.`,
      );
      continue;
    }

    // RP delay — only surface when the window is actually open
    if (pillar.title === "Delay the reliever tax" && isLatePhase) {
      active.push(
        "  • Reliever window open (R10+): SVHD is still available late — do not be the first manager to buy RP. Only break the wait if (a) an RP run of 3+ in the last 8 picks is active and the next arm is a tier above the late-round floor, OR (b) your RP slots are still empty past round 14. For your 2nd RP and beyond: do not stack another RP if an SP above your rotation's current floor is still on the board.",
      );
      continue;
    }
    if (pillar.title === "Delay the reliever tax" && !isLatePhase) {
      active.push(`  • ${pillar.title}: ${pillar.detail}`);
      continue;
    }

    // "Ratios matter" is an always-on constraint but only needs surfacing
    // when the user actually has pitchers on the roster
    if (
      pillar.title === "Ratios matter more than raw pitcher count" &&
      isPitchingPhase
    ) {
      active.push(`  • ${pillar.title}: ${pillar.detail}`);
      continue;
    }

    // All other pillars: include only if their declared phase matches
    if (
      pillar.phase === "all" ||
      (pillar.phase === "early" && clock.currentRound <= 3) ||
      (pillar.phase === "middle" && isMiddlePhase) ||
      (pillar.phase === "late" && isLatePhase)
    ) {
      active.push(`  • ${pillar.title}: ${pillar.detail}`);
    }
  }

  return active.length > 0 ? active.join("\n") : null;
}

function buildPositionBreakdownSection(
  topAvailable: ContextualPlayer[],
  allAvailable: ContextualPlayer[],
  availabilityMap: Record<string, EspnAvailabilitySignal>,
  openSlots: Record<string, number>,
  topN = 5,
): string {
  const positions: import("../types").Position[] = [
    "C",
    "1B",
    "2B",
    "3B",
    "SS",
    "OF",
    "SP",
    "RP",
  ];

  // Index of players already shown in the top 20 — use a reference tag instead of repeating stats
  const top20Index = new Map(
    topAvailable.slice(0, 20).map((e, i) => [e.player.id, i + 1]),
  );
  // Track players already shown in a previous position section to avoid cross-position stat duplication
  const shownInBreakdown = new Map<string, string>(); // playerId → first position label

  const sections: string[] = [];

  for (const position of positions) {
    // Sort by tier first (ELITE → 1 → 2 → ... → 5), then by decisionScore within tier
    const posPlayers = allAvailable
      .filter((e) => getPlayerPositions(e.player).includes(position))
      .sort((a, b) => {
        const tierDiff = tierRank(a.player.tier) - tierRank(b.player.tier);
        return tierDiff !== 0 ? tierDiff : b.decisionScore - a.decisionScore;
      })
      .slice(0, topN);
    if (posPlayers.length === 0) continue;

    const slotFilled = (openSlots[position] ?? 0) === 0;
    const posHeader = slotFilled
      ? `  ${position}: (starter slot filled — bench/IL depth only)`
      : `  ${position}:`;

    const lines: string[] = [posHeader];
    for (const entry of posPlayers) {
      const { player } = entry;
      const overallRank = top20Index.get(player.id);
      const sig = availabilityMap[player.id];
      const pressure =
        sig?.status === "now" || sig?.status === "swing"
          ? " ⚡ GONE risk"
          : sig?.status === "fragile"
            ? " ⚠ bubble"
            : " SAFER";
      const adp = sig?.adp != null ? ` ADP:${sig.adp.toFixed(0)}` : "";
      const age = player.age != null ? ` Age:${player.age}` : "";
      const tier =
        player.tier !== "5" ? ` ${formatTierLabel(player.tier)}` : "";
      const dscore = ` DS:${entry.decisionScore}`;
      const warn = entry.fitWarning ? ` ⚠ ${entry.fitWarning}` : "";
      const meaningfulLabels = entry.fitLabels.filter(
        (l) => l !== "Board value",
      );
      const labels =
        meaningfulLabels.length > 0 ? ` [${meaningfulLabels.join(", ")}]` : "";
      const twoWay = player.batting && player.pitching ? " [TWO-WAY]" : "";

      if (overallRank != null) {
        // Already in top 20 — reference only, no stat repeat
        lines.push(
          `    - ${player.name}${twoWay}${tier}${dscore}${adp}${age}${pressure}${warn} [↑ #${overallRank} in top 20]`,
        );
      } else if (shownInBreakdown.has(player.id)) {
        // Already shown in another position section — avoid repeating stats
        lines.push(
          `    - ${player.name}${twoWay}${tier}${dscore}${adp}${age}${pressure}${warn} [stats shown in ${shownInBreakdown.get(player.id)} section]`,
        );
      } else {
        // Not yet shown — display full stats and mark as shown
        shownInBreakdown.set(player.id, position);
        const stats = formatPlayerStats(player);
        const header = `    - ${player.name}${twoWay}${tier}${dscore}${adp}${age}${pressure}${labels}${warn}`;
        if (!stats) {
          lines.push(header);
        } else {
          const statLines = stats
            .split("\n")
            .map((l) => `      ${l}`)
            .join("\n");
          lines.push(`${header}\n${statLines}`);
        }
      }
    }
    sections.push(lines.join("\n"));
  }

  return `## Top Available by Position (top ${topN} per slot)\n${sections.join("\n")}`;
}

function buildRosterStrengthsSection(draftedPlayers: Player[]): string {
  const batters = draftedPlayers.filter(
    (p) => p.type === "batter" || (p.batting && p.pitching),
  );
  const pitchers = draftedPlayers.filter(
    (p) => p.type === "pitcher" || (p.batting && p.pitching),
  );
  if (batters.length === 0 && pitchers.length === 0) return "";

  // Use projections where available, fall back to current stats
  const getBatting = (p: Player) => p.projections?.batting ?? p.batting;
  const getPitching = (p: Player) => p.projections?.pitching ?? p.pitching;

  const lines: string[] = [];

  if (batters.length >= 2) {
    const avgOps =
      batters.reduce((sum, p) => sum + (getBatting(p)?.ops ?? 0), 0) /
      batters.length;
    const avgHr =
      batters.reduce((sum, p) => sum + (getBatting(p)?.hr ?? 0), 0) /
      batters.length;
    const totalSb = batters.reduce(
      (sum, p) => sum + (getBatting(p)?.sb ?? 0),
      0,
    );

    if (avgOps >= 0.83) lines.push("OPS: strong");
    else if (avgOps >= 0.78) lines.push("OPS: adequate");
    else
      lines.push(
        "OPS: below target — prioritize bats with .780+ projected OPS",
      );

    if (avgHr >= 28) lines.push("HR: strong");
    else if (avgHr >= 22) lines.push("HR: adequate");
    else lines.push("HR: light — look for power bats");

    if (totalSb >= 60) lines.push("SB: strong");
    else if (totalSb >= 35) lines.push("SB: adequate");
    else lines.push("SB: light — need speed contributors");
  }

  if (pitchers.length >= 2) {
    const avgEra =
      pitchers.reduce((sum, p) => sum + (getPitching(p)?.era ?? 0), 0) /
      pitchers.length;
    const avgWhip =
      pitchers.reduce((sum, p) => sum + (getPitching(p)?.whip ?? 0), 0) /
      pitchers.length;
    const totalK = pitchers.reduce(
      (sum, p) => sum + (getPitching(p)?.k ?? 0),
      0,
    );
    const totalSvhd = pitchers.reduce(
      (sum, p) => sum + (getPitching(p)?.svhd ?? 0),
      0,
    );

    if (avgEra <= 3.4) lines.push("ERA: strong");
    else if (avgEra <= 3.8) lines.push("ERA: adequate");
    else lines.push("ERA: elevated — favor ratio stabilizers");

    if (avgWhip <= 1.15) lines.push("WHIP: strong");
    else if (avgWhip <= 1.22) lines.push("WHIP: adequate");
    else lines.push("WHIP: elevated — favor low-walk arms");

    if (totalK >= 400) lines.push("K: strong");
    else if (totalK >= 250) lines.push("K: building");
    else lines.push("K: need volume — prioritize high-K starters");

    if (totalSvhd >= 20) lines.push("SVHD: started");
    else if (totalSvhd > 0) lines.push("SVHD: minimal — will need RP picks");
    else lines.push("SVHD: zero — RP picks needed before draft ends");
  }

  if (lines.length === 0) return "";
  return `## Roster Category Assessment\n${lines.map((l) => `  ${l}`).join("\n")}`;
}

function buildOpenSlotsSection(
  draftedPlayers: Player[],
  profile: LeagueProfile,
): string {
  const openCounts = getOpenPrimarySlots(draftedPlayers, profile.rosterSlots);
  const totalSlots = profile.rosterSlots.length;
  const filled = draftedPlayers.length;
  const remaining = totalSlots - filled;

  // Positions we want to surface explicitly (ordered by typical urgency)
  const watchPositions = ["C", "2B", "SS", "3B", "1B", "OF", "SP", "RP"];
  const openStarters: string[] = [];
  for (const pos of watchPositions) {
    const open = openCounts[pos] ?? 0;
    if (open > 0) openStarters.push(open > 1 ? `${pos}(${open})` : pos);
  }
  // BAT_FLEX covers DH + UTIL — only surface if truly empty
  const openFlex = openCounts.BAT_FLEX ?? 0;
  if (openFlex > 0) openStarters.push(`UTIL/DH(${openFlex})`);

  const starterLine =
    openStarters.length > 0
      ? `Open starters: ${openStarters.join(", ")}`
      : "All starter slots filled";

  // Bench/IL remaining
  const benchRemaining =
    remaining -
    openStarters.reduce((sum, s) => {
      const match = s.match(/\((\d+)\)/);
      return sum + (match ? parseInt(match[1]) : 1);
    }, 0) -
    openFlex;

  const lines = [
    `${filled}/${totalSlots} roster slots filled — ${remaining} picks remaining.`,
    starterLine,
  ];
  if (benchRemaining > 0) lines.push(`Open bench/IL: ${benchRemaining}`);

  return `## Roster Coverage\n${lines.map((l) => `  ${l}`).join("\n")}`;
}

// Surfaces the concrete production cost of waiting at each high-leverage position.
// For each scarce position, computes the draftScore gap between #1 and #3 available.
// A large gap means the position value evaporates fast — the AI should see this in numbers.
function buildValueGapSection(
  availablePlayers: ContextualPlayer[],
  currentRound: number,
  openSlots: Record<string, number>,
): string {
  const scarcePositions: import("../types").Position[] = [
    "C",
    "SS",
    "2B",
    "3B",
    "SP",
    "RP",
  ];
  const lines: string[] = [];
  // Lower threshold in later rounds where scores compress
  const gapThreshold = currentRound >= 10 ? 5 : currentRound >= 7 ? 6 : 8;

  for (const position of scarcePositions) {
    // Skip positions where starter slot is already filled
    if ((openSlots[position] ?? 0) === 0) continue;

    const posPlayers = availablePlayers
      .filter((e) => getPlayerPositions(e.player).includes(position))
      .sort((a, b) => b.draftScore - a.draftScore);

    if (posPlayers.length < 2) continue;

    const best = posPlayers[0];
    const third = posPlayers[Math.min(2, posPlayers.length - 1)];
    const gap = best.draftScore - third.draftScore;

    if (gap >= gapThreshold) {
      const tierDrop =
        best.player.tier !== third.player.tier
          ? ` (${formatTierLabel(best.player.tier)}\u2192${formatTierLabel(third.player.tier)} tier drop)`
          : "";
      lines.push(
        `  - ${position}: #1 available is ${best.player.name} (score ${best.draftScore}) vs. #3 is ${third.player.name} (score ${third.draftScore}) \u2014 gap ${gap} pts${tierDrop}. Passing on ${best.player.name} costs you ${gap} points of value at this position.`,
      );
    }
  }

  if (lines.length === 0) return "";
  return `## Position Value Gaps (where waiting costs the most)\n${lines.join("\n")}`;
}

export function buildAdvicePrompt(context: AdviceContext): {
  system: string;
  user: string;
} {
  const {
    leagueConfig,
    profile,
    clock,
    draftedPlayers,
    availablePlayers,
    topAvailable,
    recentTaken,
    availabilityMap,
    draftHistory,
  } = context;
  const hasShoheiOhtani = draftedPlayers.some(isShoheiOhtani);
  const replacementBaselineNote = getReplacementBaselineNote(leagueConfig);
  const openSlots = getOpenPrimarySlots(draftedPlayers, profile.rosterSlots);
  const positionCliffLines = buildPositionCliffLines(
    availablePlayers,
    clock.currentPick,
    availabilityMap,
    openSlots,
  );
  const runAlertLines = buildRunAlertLines(recentTaken);
  const hasWrapPicks =
    clock.isUserOnClock &&
    clock.upcomingUserPicks.length >= 2 &&
    clock.upcomingUserPicks[1] === (clock.nextUserPick ?? 0) + 1;

  const battingCats = leagueConfig.scoringCategories.batting.join(", ");
  const pitchingCats = leagueConfig.scoringCategories.pitching.join(", ");
  const scoringLine = `Batting: ${battingCats} | Pitching: ${pitchingCats}`;
  const rounds = leagueConfig.draftInfo.totalPicks / leagueConfig.teams;

  const system = `## League Context
${leagueConfig.teams}-team ${leagueConfig.format} categories, ${rounds} rounds, snake draft
Scoring — ${scoringLine}
Roster: ${leagueConfig.roster.batting} | ${leagueConfig.roster.pitching} | ${leagueConfig.roster.bench} bench | ${leagueConfig.roster.il} IL
Draft slot: ${leagueConfig.draftInfo.pickNumber}

## Draft Perspective
${profile.draftPerspective}

You are an elite fantasy baseball draft advisor embedded in a live draft tool. You have real-time access to the board state including player stats, ESPN availability pressure, and historical draft patterns for every manager in this room.

DECISION SCORES: Every player in the board state has a Decision Score (0–100). This score is ALREADY adjusted for draft phase, roster fit, positional scarcity, category leak patches, and injury penalties. Treat it as your primary ranking signal. When two players are within 3 points, use availability pressure and tier cliff context to break the tie. Do not override the Decision Score ranking by more than 5 positions without explicitly justifying why.

OUTPUT RULES: ${
    hasWrapPicks
      ? `Respond in pick pairs. Use exactly these labels: Recommendation A, Recommendation B, and Pivot Pair. Recommendation A is the first pick in the package, Recommendation B is the second pick, and Pivot Pair is an alternative two-pick package that takes a different strategic direction on the same live board — not a fallback for missing players, but a second valid path that makes different tradeoffs (e.g., different category focus, different positional priority, different tier philosophy).

SAFER PICK ACCOUNTABILITY (wrap pairs): Before finalizing your two-pick package, scan the board for any SWING (⚡) or BUBBLE (⚠) players within 8 decision score points of your recommendations. If any exist, you MUST address them: either (a) replace the SAFER pick with the urgent one and explain the swap, or (b) explicitly state "I am passing on [urgent player] because [reason]" and quantify why the SAFER pick wins. If BOTH of your recommendations are SAFER and urgent alternatives exist, that is a red flag — you are almost certainly leaving value on the board by waiting. Restructure the pair.`
      : `Lead with one clear recommendation in a single sentence, then explain.

SAFER PICK ACCOUNTABILITY: Before finalizing your recommendation, scan the top 10 available for any ⚡ GONE or ⚠ BUBBLE player within 8 decision score points of your pick. If one exists, you MUST either (a) recommend the urgent player instead, or (b) explicitly state "I am passing on [urgent player] because [reason]." Do not silently ignore urgent alternatives. If your recommendation is SAFER, you MUST add: "This player should be here next round — only take now if the board has no better urgent need."`
  }

RESPONSE FORMAT: Structure your response as:
1. **Pick** — one sentence: "[Player Name] at [position]" with the core reason.
2. **Why now** — 2-3 sentences: projected stats, availability pressure, and what you'd lose by waiting.
3. **What you're passing on** — 1-2 sentences: best alternative considered and why it lost.${hasWrapPicks ? "" : "\n4. **Next-pick lookahead** — 1 sentence: what to target with the next pick given this choice."}
Keep the total response under 200 words. Do not repeat stat lines already visible in the board state — reference them, don't transcribe them.

CRITICAL — STATS: Anchor on 2026 Steamer projections — these drive your recommendation. Use 2025 actuals and prior seasons only for: durability (PA volume), track record validation, and regression flags. Do NOT use your training-data memory of player reputations — work exclusively from the numbers provided. When referencing a player's production, cite the projected stat line. When flagging risk, cite the actuals or PA history.

NORMALIZATION: ${replacementBaselineNote}

CRITICAL — STRATEGY: Your recommendations MUST follow the user's stated strategy pillars. They are operating constraints, not suggestions.

Exception — BOARD OVERRIDE: You may bend ONE strategy rule if a player meets ALL THREE criteria:
  1. Top 3 on the overall available board by Decision Score.
  2. Last or second-to-last player at their tier at a scarce position (C, SS, 2B, or SP).
  3. The next available player at that position drops 2+ full tiers.
If invoking: label it "BOARD OVERRIDE," name the rule being bent, and quantify the tier drop. Do not invoke for generic "good value" — tier extinction at a scarce position only.

EXECUTION: Use the positional tier cliff section and run alert section as hard decision sensors. In a shallow room, tier drop-offs are more punishing because every opponent is also stacked. If a top tier at a scarce position is about to end inside the user's draft window, elevate that position over a generic value play. If a C or RP run is active, explicitly decide whether the next player in that run is worth breaking the wait strategy.

CRITICAL — AVAILABILITY SIGNALS: The labels (⚡ GONE risk, ⚠ bubble, SAFER) reflect ESPN autopick math + screen visibility. "SAFER" = ranked outside the top 20 on ESPN's live board, unlikely taken unless an opponent actively hunts. When a BUBBLE/GONE player and a SAFER player are within ~5 decision score points, always prefer the urgent player and leave the SAFER one for next pick.

OPPONENT INTELLIGENCE: Use the historical manager tendencies as predictive signals, not trivia. If a manager "always goes pitcher early" and hasn't drafted SP yet, an SP run is imminent — accelerate any SP you need. If a manager's best finish correlates with a specific draft pattern, weigh their picks more heavily as competitive threats. Name the specific opponent when flagging a steal risk.

TONE: Be decisive. Make a call on every tradeoff — do not hedge on obvious picks. Do not bury genuine red flags behind praise. Never recommend a player "for the name" — if the projected stats don't justify the pick, say so.

DURABILITY: PA is the primary durability signal (600+ = full season; 300-450 = significant concern). Flag low-PA players explicitly in any premium window and explain why it's worth taking there. Age 35+ bounce-back carries regression risk — name it. Do not stack two high-variance players in the same pick window unless alternatives are materially worse.

CRITICAL — LONG-TERM INJURIES: Any player whose fit warning references a multi-month return (June, July, August, "60-day IL", "months") carries a dead active roster slot through those weeks of H2H matchups. NEVER recommend such a player to fill an active starter need. They are IL-stash candidates only — appropriate in late rounds if (a) the user has open IL slots, (b) the position is already covered by healthy starters, and (c) the player's upside on return justifies the pick. If you recommend a multi-month injury case, label it explicitly as "IL STASH ONLY" and confirm the user has IL slots available before making the case.

TWO-WAY PLAYERS: Players with both batting AND pitching stats contribute to all relevant categories on both sides — that dual contribution is a major multiplier in H2H categories. Weight them accordingly.

BENCH & ENDGAME: Once all starter slots at a position are filled, picks for that position serve a different purpose. Bench picks should prioritize in order: (a) injury insurance for your top-3 highest-value starters — if a star misses time, the position must be covered; (b) multi-position eligibility / UTIL flexibility that can slide into any gap; (c) category ceiling swing — a bench bat with HR/SVHD upside or a streaming SP. Do not apply starter-level urgency to bench fills — a bench bat does not need to be elite, just useful.

ANTI-PATTERNS — Do NOT:
- Recommend a player whose projected stats are at or below the replacement-level baseline in their primary category, unless filling a structural need (C, SB, SVHD).
- Suggest "grabbing" an SP in rounds 3-6 because they're "good value" — this violates the delay-SP strategy unless it qualifies as a BOARD OVERRIDE.
- Recommend two players at the same position in the same pick window when other positions have open starter slots.
- Describe a player as "safe" or "solid" without citing the specific projected stat line that makes them above replacement level.
- Stack more than 4 OF-eligible starters. Once that cap is hit, treat additional OF picks as dead slots and redirect to positional need or category leak regardless of Decision Score.
${hasShoheiOhtani ? "\nOHTANI: Shohei Ohtani is on the user's roster as an active two-way player. He occupies the DH slot and counts as SP1 for strategy purposes. Do not ask for clarification about eligibility." : ""}`;

  const rosterLines = draftedPlayers.map((p, i) => {
    const stats = formatPlayerStats(p);
    const twoWay = p.batting && p.pitching ? " [TWO-WAY]" : "";
    const header = `  R${i + 1}: ${p.name} (${formatPositionLabel(p)})${twoWay}`;
    if (!stats) return header;
    // Indent each stat line under the player header
    const statLines = stats
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    return `${header}\n${statLines}`;
  });

  const avail = classifyAvailability(topAvailable, availabilityMap);

  const topPlayerLines = topAvailable.slice(0, 20).map((entry, i) => {
    const { player } = entry;
    const sig = availabilityMap[player.id];
    const pressure =
      sig?.status === "now" || sig?.status === "swing"
        ? " ⚡ GONE risk"
        : sig?.status === "fragile"
          ? " ⚠ bubble"
          : " SAFER";
    const twoWay = player.batting && player.pitching ? " [TWO-WAY]" : "";
    const adp = sig?.adp != null ? ` ADP:${sig.adp.toFixed(0)}` : "";
    const age = player.age != null ? ` Age:${player.age}` : "";
    const stats = formatPlayerStats(player);
    // Filter out the generic "Board value" fallback label — it adds no signal
    const meaningfulLabels = entry.fitLabels.filter((l) => l !== "Board value");
    const labels =
      meaningfulLabels.length > 0 ? ` [${meaningfulLabels.join(", ")}]` : "";
    const warn = entry.fitWarning ? ` ⚠ ${entry.fitWarning}` : "";
    const tier = player.tier !== "5" ? ` ${formatTierLabel(player.tier)}` : "";
    const dscore = ` DS:${entry.decisionScore}`;
    const header = `  ${i + 1}. ${player.name} (${formatPositionLabel(player)})${twoWay}${tier}${dscore}${adp}${age}${pressure}${labels}${warn}`;
    if (!stats) return `${header} — no stats`;
    // Indent each stat line (current year + history + projections) under the player header
    const statLines = stats
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    return `${header}\n${statLines}`;
  });

  const teams = leagueConfig.teams;
  const roundGroups = new Map<
    number,
    { player: Player; takenAtPick: number }[]
  >();
  for (const t of recentTaken) {
    const round = Math.ceil(t.takenAtPick / teams);
    if (!roundGroups.has(round)) roundGroups.set(round, []);
    roundGroups.get(round)!.push(t);
  }
  const recentLines: string[] = [];
  for (const [round, picks] of [...roundGroups.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    recentLines.push(`  Round ${round}:`);
    for (const t of picks.sort((a, b) => a.takenAtPick - b.takenAtPick)) {
      recentLines.push(
        `    Pick ${t.takenAtPick}: ${t.player.name} (${formatPositionLabel(t.player)})`,
      );
    }
  }

  const historySection = draftHistory
    ? `## Opponent Historical Tendencies (merged across ${draftHistory.seasons.map((s) => s.seasonId).join(", ")} — may include managers no longer active in this league)\n${describeManagerPatterns(draftHistory)}`
    : "";

  const totalPicks = leagueConfig.draftInfo.totalPicks;
  const pctThrough = Math.round((clock.currentPick / totalPicks) * 100);
  const clockLine = clock.isUserOnClock
    ? `You are ON THE CLOCK. Pick ${clock.currentPick} of ${totalPicks} overall (Round ${clock.currentRound}, pick ${clock.roundPick}). Draft is ${pctThrough}% complete.`
    : clock.currentPick >= totalPicks
      ? `Draft complete. ${totalPicks}/${totalPicks} picks made.`
      : `Current pick: ${clock.currentPick} of ${totalPicks} (${pctThrough}% complete). YOUR next pick: ${clock.nextUserPick ?? "?"} (${clock.picksUntilUser ?? "?"} picks away, Round ${clock.currentRound}).`;

  const snakeNote = hasWrapPicks
    ? `You have back-to-back picks (${clock.nextUserPick} and ${clock.upcomingUserPicks[1]}) — treat this as a two-pick window.`
    : "";

  const wrapOutputNote = hasWrapPicks
    ? `You are at the wrap. Think in pairs, not single picks. Provide Recommendation A (pick ${clock.nextUserPick}) and Recommendation B (pick ${clock.upcomingUserPicks[1]}). Then provide a Pivot Pair: a second two-pick package that pursues an equally valid but strategically different direction — not a contingency for missing players, but a genuine alternative angle on the same live board (e.g., optimizing for a different category, a different positional priority, or a different tier philosophy).`
    : "";

  const strategyLines = buildStrategyLines(profile, clock, openSlots);

  const warningsSection =
    profile.dataWarnings.length > 0
      ? `## Data Caveats\n${profile.dataWarnings.map((w) => `  - ${w}`).join("\n")}`
      : "";

  const positionCliffSection =
    positionCliffLines.length > 0
      ? `## Positional Tier Cliffs\n${positionCliffLines.join("\n")}`
      : "";

  const valueGapSection = buildValueGapSection(
    availablePlayers,
    clock.currentRound,
    openSlots,
  );

  const runAlertSection =
    runAlertLines.length > 0
      ? `## Run Alerts\n${runAlertLines.join("\n")}`
      : "## Run Alerts\n  - No current position run has hit the 3-of-last-8 panic threshold.";

  const strategySection = strategyLines
    ? `## Active Strategy Constraints\n${strategyLines}\n\n`
    : "";

  const user = `${strategySection}## Current State
${[clockLine, snakeNote, wrapOutputNote].filter(Boolean).join("\n")}

## Your Current Roster (${draftedPlayers.length} picks)
${rosterLines.length > 0 ? rosterLines.join("\n") : "  (no picks yet)"}

${buildOpenSlotsSection(draftedPlayers, profile)}

${buildRosterStrengthsSection(draftedPlayers)}

## Top Available Players (with stats)
${topPlayerLines.join("\n")}

${buildPositionBreakdownSection(topAvailable, availablePlayers, availabilityMap, openSlots)}

${positionCliffSection}

${valueGapSection}

## Board Availability Pressure
Likely gone before your next turn: ${avail.likelyGone.length > 0 ? avail.likelyGone.join(", ") : "none flagged"}
On the bubble: ${avail.bubble.length > 0 ? avail.bubble.join(", ") : "none flagged"}

${runAlertSection}

## Recent Room Picks
${recentLines.length > 0 ? recentLines.join("\n") : "  (none yet)"}

${historySection}

${warningsSection}

PICK: Round ${clock.currentRound}, Pick ${clock.currentPick} overall${hasWrapPicks ? " — answer in two-pick packages." : "."}`;

  return { system, user };
}
