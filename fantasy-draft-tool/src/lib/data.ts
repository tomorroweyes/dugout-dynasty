import type {
  DraftData,
  EspnLeagueData,
  LeagueConfig,
  LeagueProfile,
  Player,
  PlayerType,
  Position,
  RosterSlot,
  StrategyPhase,
  Tier,
} from "../types";
import {
  ADP_BUFFER,
  BATTER_AGE_PENALTIES,
  BATTER_THRESHOLDS,
  BATTER_WEIGHTS,
  CATEGORY_LEAK,
  CONTEXT,
  INJURY_PENALTIES,
  PHASE_BOUNDARIES,
  PITCHER_EXPERT_MODIFIERS,
  SCARCITY_BONUSES,
  TIER_THRESHOLDS,
} from "./scoring-config";

export type DraftViewFilter = "ALL" | PlayerType;
export type FocusArea =
  | "ALL"
  | "power"
  | "speed"
  | "ratios"
  | "floor"
  | "upside";

export interface EvaluatedPlayer {
  player: Player;
  draftScore: number;
  archetype: string;
  strengths: string[];
  weaknesses: string[];
  focusTags: FocusArea[];
  primaryStat: { label: string; value: string };
  secondaryStats: Array<{ label: string; value: string }>;
  caution?: string;
}

export interface CategoryMeter {
  id: string;
  label: string;
  support: "available" | "missing";
  trend: "higher" | "lower";
  value: number | null;
  display: string;
  note: string;
}

export interface ContextualPlayer extends EvaluatedPlayer {
  decisionScore: number;
  fitLabels: string[];
  fitWarning?: string;
}

export interface StrategySnapshot {
  phase: StrategyPhase;
  phaseLabel: string;
  buildLabel: string;
  headline: string;
  detail: string;
  priorityLabels: string[];
  exploit: string;
  warnings: string[];
}

export interface DraftClock {
  currentPick: number;
  currentRound: number;
  roundPick: number;
  isUserOnClock: boolean;
  nextUserPick: number | null;
  picksUntilUser: number | null;
  upcomingUserPicks: number[];
}

export interface EspnAvailabilitySignal {
  espnRank: number | null;
  adp: number | null;
  windowPicks: number;
  status: "now" | "swing" | "fragile" | "safe" | "unknown";
  note: string;
}

const TIER_ORDER: Record<Tier, number> = {
  ELITE: 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
};

export function getPlayerPositions(player: Player): Position[] {
  return player.positions && player.positions.length > 0
    ? player.positions
    : [player.position];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isBenchSlot(slot: RosterSlot): boolean {
  return (
    slot.id.toLowerCase().startsWith("bench") ||
    slot.label.toLowerCase().includes("bench")
  );
}

function getUserRosterSize(league: LeagueConfig): number {
  return Math.ceil(league.draftInfo.totalPicks / league.teams);
}

function getDraftPhase(
  league: LeagueConfig,
  draftedPlayers: Player[],
  rosterSlots?: RosterSlot[],
): StrategyPhase {
  const userRosterSize = getUserRosterSize(league);
  const picksMade = draftedPlayers.length;

  // Roster-composition override: if 75%+ of starter batting slots are already filled,
  // we are past the early bat-accumulation phase even if pick count says otherwise.
  // This catches heavy-bats-first drafters who need to shift priorities mid-flow.
  if (rosterSlots) {
    const openSlots = getOpenPrimarySlots(draftedPlayers, rosterSlots);
    const totalBatStarters = rosterSlots.filter(
      (s) => !isBenchSlot(s) && s.type === "batter",
    ).length;
    const openBatCount = Object.entries(openSlots)
      .filter(([key]) => key !== "SP" && key !== "RP")
      .reduce((sum, [, val]) => sum + val, 0);
    const filledBatPct =
      totalBatStarters > 0 ? 1 - openBatCount / totalBatStarters : 1;
    if (
      filledBatPct >= PHASE_BOUNDARIES.bat_fill_override &&
      picksMade <
        Math.max(
          PHASE_BOUNDARIES.early_min_picks,
          Math.ceil(userRosterSize * PHASE_BOUNDARIES.early_fraction),
        )
    ) {
      return "middle";
    }
  }

  if (
    picksMade <
    Math.max(
      PHASE_BOUNDARIES.early_min_picks,
      Math.ceil(userRosterSize * PHASE_BOUNDARIES.early_fraction),
    )
  ) {
    return "early";
  }
  if (
    picksMade < Math.ceil(userRosterSize * PHASE_BOUNDARIES.middle_fraction)
  ) {
    return "middle";
  }
  return "late";
}

function getPhaseLabel(phase: StrategyPhase): string {
  if (phase === "early") {
    return "Opening leverage";
  }
  if (phase === "middle") {
    return "Build consolidation";
  }
  return "Patch and exploit";
}

function getStarterTargets(rosterSlots: RosterSlot[]): {
  batterStarters: number;
  pitcherStarters: number;
} {
  const starterSlots = rosterSlots.filter((slot) => !isBenchSlot(slot));

  return {
    batterStarters: starterSlots.filter((slot) => slot.type === "batter")
      .length,
    pitcherStarters: starterSlots.filter((slot) => slot.type === "pitcher")
      .length,
  };
}

function getPositionCounts(players: Player[]): Record<string, number> {
  return players.reduce<Record<string, number>>((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

export function getOpenPrimarySlots(
  draftedPlayers: Player[],
  rosterSlots: RosterSlot[],
): Record<string, number> {
  const starterSlots = rosterSlots.filter((slot) => !isBenchSlot(slot));
  const openCounts = starterSlots.reduce<Record<string, number>>(
    (counts, slot) => {
      const normalized = slot.label.toLowerCase();
      if (normalized.startsWith("of")) {
        counts.OF = (counts.OF ?? 0) + 1;
      } else if (normalized.startsWith("sp")) {
        counts.SP = (counts.SP ?? 0) + 1;
      } else if (normalized.startsWith("rp")) {
        counts.RP = (counts.RP ?? 0) + 1;
      } else if (normalized.startsWith("util") || normalized === "dh") {
        counts.BAT_FLEX = (counts.BAT_FLEX ?? 0) + 1;
      } else {
        counts[slot.label.toUpperCase()] =
          (counts[slot.label.toUpperCase()] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );

  draftedPlayers.forEach((player) => {
    const positions = getPlayerPositions(player);
    for (const position of positions) {
      if ((openCounts[position] ?? 0) > 0) {
        openCounts[position] -= 1;
        return;
      }
    }

    if (player.type === "batter" && (openCounts.BAT_FLEX ?? 0) > 0) {
      openCounts.BAT_FLEX -= 1;
      return;
    }

    if (positions.includes("SP") && (openCounts.SP ?? 0) > 0) {
      openCounts.SP -= 1;
      return;
    }

    if (positions.includes("RP") && (openCounts.RP ?? 0) > 0) {
      openCounts.RP -= 1;
    }
  });

  return openCounts;
}

function buildCategoryProfile(draftedPlayers: Player[], allPlayers: Player[]) {
  const draftedBatters = draftedPlayers.filter(
    (player) => player.type === "batter",
  );
  const draftedPitchers = draftedPlayers.filter(
    (player) => player.type === "pitcher",
  );
  const allBatters = allPlayers.filter((player) => player.type === "batter");
  const allPitchers = allPlayers.filter((player) => player.type === "pitcher");

  // Use the same 50/50 blend (actuals + Steamer) as draftScore and tier, so leak
  // detection signals match the scoring view consistently across all three systems.
  const draftedOps = average(
    draftedBatters
      .map((player) => blendBatting(player)?.ops ?? 0)
      .filter(Boolean),
  );
  const draftedHr = average(
    draftedBatters.map((player) => blendBatting(player)?.hr ?? 0),
  );
  const draftedSb = average(
    draftedBatters.map((player) => blendBatting(player)?.sb ?? 0),
  );
  const draftedK = average(
    draftedPitchers.map((player) => blendPitching(player)?.k ?? 0),
  );
  const draftedQs = average(
    draftedPitchers.map((player) => blendPitching(player)?.qs ?? 0),
  );
  const draftedEra = average(
    draftedPitchers
      .map((player) => blendPitching(player)?.era ?? 0)
      .filter(Boolean),
  );
  const draftedWhip = average(
    draftedPitchers
      .map((player) => blendPitching(player)?.whip ?? 0)
      .filter(Boolean),
  );
  const draftedSvhd = average(
    draftedPitchers.map((player) => blendPitching(player)?.svhd ?? 0),
  );

  const poolOps = average(
    allBatters.map((player) => blendBatting(player)?.ops ?? 0).filter(Boolean),
  );
  const poolHr = average(
    allBatters.map((player) => blendBatting(player)?.hr ?? 0),
  );
  const poolSb = average(
    allBatters.map((player) => blendBatting(player)?.sb ?? 0),
  );
  const poolK = average(
    allPitchers.map((player) => blendPitching(player)?.k ?? 0),
  );
  const poolQs = average(
    allPitchers.map((player) => blendPitching(player)?.qs ?? 0),
  );
  const poolEra = average(
    allPitchers
      .map((player) => blendPitching(player)?.era ?? 0)
      .filter(Boolean),
  );
  const poolWhip = average(
    allPitchers
      .map((player) => blendPitching(player)?.whip ?? 0)
      .filter(Boolean),
  );
  const poolSvhd = average(
    allPitchers.map((player) => blendPitching(player)?.svhd ?? 0),
  );

  return {
    draftedOps,
    draftedHr,
    draftedSb,
    draftedK,
    draftedQs,
    draftedEra,
    draftedWhip,
    draftedSvhd,
    weakOps:
      draftedBatters.length > 1 && draftedOps < poolOps * CATEGORY_LEAK.ops,
    weakPower:
      draftedBatters.length > 1 && draftedHr < poolHr * CATEGORY_LEAK.power,
    weakSpeed:
      draftedBatters.length > 1 && draftedSb < poolSb * CATEGORY_LEAK.speed,
    weakStrikeouts:
      draftedPitchers.length > 1 && draftedK < poolK * CATEGORY_LEAK.k,
    weakQs:
      draftedPitchers.length > 1 &&
      draftedQs > 0 &&
      draftedQs < poolQs * CATEGORY_LEAK.qs,
    weakRatios:
      draftedPitchers.length > 1 &&
      ((draftedEra > 0 &&
        poolEra > 0 &&
        draftedEra > poolEra * CATEGORY_LEAK.era) ||
        (draftedWhip > 0 &&
          poolWhip > 0 &&
          draftedWhip > poolWhip * CATEGORY_LEAK.whip)),
    needsReliefHelp:
      draftedPitchers.length >= 4 &&
      draftedSvhd >= 0 &&
      draftedSvhd < Math.max(poolSvhd * CATEGORY_LEAK.svhd_floor, 2),
  };
}

function buildBuildLabel(
  batters: number,
  pitchers: number,
  sps: number,
  rps: number,
): string {
  if (batters === 0 && pitchers === 0) {
    return "Blank slate";
  }
  if (pitchers === 0) {
    return "Star-bat opening";
  }
  if (batters >= pitchers + 2) {
    return "Hitter-led build";
  }
  if (pitchers >= batters + 1 && sps >= 2) {
    return "Pitching-forward build";
  }
  if (rps >= 2 && batters < pitchers) {
    return "Relief-tilted shape";
  }
  return "Balanced spine";
}

export function buildStrategySnapshot(
  draftedPlayers: Player[],
  allPlayers: Player[],
  league: LeagueConfig,
  rosterSlots?: RosterSlot[],
): StrategySnapshot {
  const phase = getDraftPhase(league, draftedPlayers, rosterSlots);
  const phaseLabel = getPhaseLabel(phase);
  const batters = draftedPlayers.filter(
    (player) => player.type === "batter",
  ).length;
  const pitchers = draftedPlayers.filter(
    (player) => player.type === "pitcher",
  ).length;
  const sps = draftedPlayers.filter(
    (player) => player.position === "SP",
  ).length;
  const rps = draftedPlayers.filter(
    (player) => player.position === "RP",
  ).length;
  const buildLabel = buildBuildLabel(batters, pitchers, sps, rps);
  const categoryProfile = buildCategoryProfile(draftedPlayers, allPlayers);
  const userSlot = league.draftInfo.pickNumber;
  const warnings = [
    "In an 8-team room, shallow replacement depth makes fake scarcity less important than category separation.",
    "One-catcher and SV+H formats both reduce the need to pay an early tax for catcher or closers.",
  ];

  if (phase === "early" && userSlot === 1 && draftedPlayers.length === 0) {
    return {
      phase,
      phaseLabel,
      buildLabel,
      headline: "At 1.01, take the cleanest category monster on the board.",
      detail:
        "Start with the elite bat who gives you the biggest weekly edge across OPS, power, runs production, and enough speed that you are not forced into rabbit picks later. Only pivot to an ace if the hitter tier is clearly gone.",
      priorityLabels: [
        "Bank OPS + HR first",
        "Leave steals flexible",
        "No early catcher or RP tax",
      ],
      exploit:
        "The edge from 1.01 is star separation. In a shallow H2H league, that matters more than locking positions early.",
      warnings,
    };
  }

  if (phase === "early") {
    return {
      phase,
      phaseLabel,
      buildLabel,
      headline:
        pitchers === 0
          ? "Keep leaning into elite bats until the SP value is clean."
          : "You already bought some pitching, so protect the offense floor next.",
      detail:
        pitchers === 0
          ? "The first job is building category insulation. In this room, hitters are harder to reconstruct later than an SP2 or SV+H package."
          : "Early pitching is fine if it came at the right price, but do not come out of the opening turns short on bat volume and OPS stability.",
      priorityLabels: [
        "Multi-category bats",
        "One ace max unless value falls",
        "Ignore fake scarcity",
      ],
      exploit:
        "Let other managers pay for catcher comfort or closer labels while you collect players who actually move multiple categories.",
      warnings,
    };
  }

  if (phase === "middle") {
    const priorityLabels = [
      sps < 2 ? "Add SP anchor depth" : "Protect ratio floor",
      categoryProfile.weakSpeed ? "Patch steals now" : "Keep speed flexible",
      categoryProfile.weakOps ? "Stabilize OPS" : "Preserve bat quality",
    ];

    return {
      phase,
      phaseLabel,
      buildLabel,
      headline:
        sps < 2
          ? "This is where the build gets real: finish your SP backbone before chasing luxuries."
          : "Use the middle rounds to fix categories, not to hoard names.",
      detail:
        categoryProfile.weakSpeed || categoryProfile.weakOps
          ? "Your current build has category pressure. Attack the weak spot with players who help without forcing you into new damage elsewhere."
          : "You are no longer buying stars alone. You are buying lineup shape, QS reliability, and categories that will survive weekly variance.",
      priorityLabels,
      exploit:
        "Middle rounds are where most rooms overreact to runs. Take the player who closes a real category leak or secures your SP2/SP3 quality band.",
      warnings,
    };
  }

  return {
    phase,
    phaseLabel,
    buildLabel,
    headline:
      "Late rounds are for category patches and cuttable upside, not comfort picks.",
    detail:
      "Use this zone to finish RP volume for SV+H, add speed or power patches, and take arms or bats you can move on from quickly if role or schedule turns against them.",
    priorityLabels: [
      categoryProfile.needsReliefHelp
        ? "Add RP leverage"
        : "Take volatile upside",
      categoryProfile.weakSpeed ? "Cheap steals" : "Bench thump",
      categoryProfile.weakRatios ? "Ratio shield" : "Streamable SP depth",
    ],
    exploit:
      "Do not draft low-ceiling names you will never start. The endgame should be built from players you can either deploy aggressively or cut immediately.",
    warnings,
  };
}

// Computes a bonus for positional scarcity: rewards taking players at positions where
// the current tier is nearly exhausted AND the drop to the next tier is steep.
// This surfaces the "if not now, then T3" urgency in the numeric Decision Score itself —
// not just in the AI advice prompt — so the user sees it on every card.
function getPositionalScarcityBonus(
  position: string,
  tier: Tier,
  positionTierMap: Record<string, Partial<Record<Tier, number>>>,
): { bonus: number; label: string | null } {
  const tierOrder: Tier[] = ["ELITE", "1", "2", "3", "4", "5"];
  const currentIdx = tierOrder.indexOf(tier);
  if (currentIdx === -1) return { bonus: 0, label: null };

  const tierCounts = positionTierMap[position] ?? {};
  const countAtTier = tierCounts[tier] ?? 0;

  // Find how many tier steps down until the next non-empty tier
  let nextIdx = currentIdx + 1;
  while (
    nextIdx < tierOrder.length &&
    (tierCounts[tierOrder[nextIdx]] ?? 0) === 0
  ) {
    nextIdx++;
  }
  const dropSteps = nextIdx - currentIdx;

  if (countAtTier <= 1 && dropSteps >= 2)
    return {
      bonus: SCARCITY_BONUSES.tier_cliff_deep_single,
      label: "Tier cliff soon",
    };
  if (countAtTier <= 2 && dropSteps >= 2)
    return {
      bonus: SCARCITY_BONUSES.tier_cliff_deep_double,
      label: "Tier cliff soon",
    };
  if (countAtTier <= 1 && dropSteps === 1)
    return {
      bonus: SCARCITY_BONUSES.dwindling_single,
      label: "Dwindling tier",
    };
  if (countAtTier <= 3 && dropSteps >= 2)
    return {
      bonus: SCARCITY_BONUSES.dwindling_triple,
      label: "Dwindling tier",
    };
  if (countAtTier <= 2 && dropSteps === 1)
    return { bonus: SCARCITY_BONUSES.dwindling_double, label: null };
  return { bonus: 0, label: null };
}

export function applyDraftContext(
  players: EvaluatedPlayer[],
  draftedPlayers: Player[],
  allPlayers: Player[],
  league: LeagueConfig,
  rosterSlots: RosterSlot[],
  currentPick: number = 1,
  adpMap: Record<string, number> = {},
): ContextualPlayer[] {
  const phase = getDraftPhase(league, draftedPlayers, rosterSlots);
  const categoryProfile = buildCategoryProfile(draftedPlayers, allPlayers);
  const openSlots = getOpenPrimarySlots(draftedPlayers, rosterSlots);
  const positionCounts = getPositionCounts(draftedPlayers);
  const pitcherCount = draftedPlayers.filter(
    (player) => player.type === "pitcher",
  ).length;
  const spCount = draftedPlayers.filter((player) =>
    getPlayerPositions(player).includes("SP"),
  ).length;
  const rpCount = draftedPlayers.filter((player) =>
    getPlayerPositions(player).includes("RP"),
  ).length;
  const batterCount = draftedPlayers.filter(
    (player) => player.type === "batter",
  ).length;
  const starterTargets = getStarterTargets(rosterSlots);

  // Build a per-position tier count map across all available (undrafted) players
  // so we can compute how scarce each tier-position combo is right now.
  // Count a player toward every position they're eligible for so cliff detection
  // is accurate (a SS/3B player is a valid 3B option and should count there too).
  const positionTierMap: Record<string, Partial<Record<Tier, number>>> = {};
  for (const entry of players) {
    const tier = entry.player.tier;
    for (const pos of getPlayerPositions(entry.player)) {
      if (!positionTierMap[pos]) positionTierMap[pos] = {};
      positionTierMap[pos][tier] = (positionTierMap[pos][tier] ?? 0) + 1;
    }
  }

  return players
    .map<ContextualPlayer>((entry) => {
      const { player } = entry;
      let decisionScore = entry.draftScore;
      const fitLabels: string[] = [];
      let fitWarning: string | undefined;

      if (player.injured) {
        const penalty = getInjuryPenalty(player.injuryStatus, player.notes);
        decisionScore -= penalty;
        const severityLabel = getInjurySeverityLabel(
          player.injuryStatus,
          player.notes,
        );
        const noteDetail =
          player.notes && player.notes.length > 0
            ? ` — ${player.notes[0]}`
            : "";
        fitWarning = `${severityLabel}${noteDetail}`;
      }

      // Expert rank is used only as an internal scoring signal — not surfaced in the prompt.
      if (player.type === "pitcher") {
        decisionScore += getPitcherExpertRankModifier(player.expertRank);
      } else if (
        player.expertRank == null &&
        (phase === "early" || phase === "middle")
      ) {
        decisionScore += CONTEXT.batter_no_expert_rank;
      }

      const playerPositions = getPlayerPositions(player);
      const isC = playerPositions.includes("C");
      const isSP = playerPositions.includes("SP");
      const isRP = playerPositions.includes("RP");

      if (phase === "early") {
        if (player.type === "batter") {
          decisionScore += CONTEXT.early_batter_bonus;
          fitLabels.push("Early bat edge");
          if (
            entry.strengths.includes("OPS floor") &&
            entry.strengths.includes("Power")
          ) {
            decisionScore += CONTEXT.early_batter_category_anchor;
            fitLabels.push("Category anchor");
          }
          if (entry.strengths.includes("Speed")) {
            decisionScore += CONTEXT.early_batter_speed_bonus;
          }
        }

        if (isSP) {
          decisionScore +=
            spCount === 0 ? CONTEXT.early_sp_first : CONTEXT.early_sp_extra;
          if (entry.strengths.includes("Ratios")) {
            decisionScore += CONTEXT.early_sp_ratios_bonus;
            fitLabels.push("Ace fallback");
          }
        }

        if (isRP) {
          decisionScore += CONTEXT.early_rp_penalty;
          fitWarning = "Too early to pay for reliever labels in SV+H.";
        }

        if (isC) {
          decisionScore += CONTEXT.early_c_penalty;
          fitWarning =
            "One-catcher shallows rarely reward an early catcher tax.";
        }
      }

      if (phase === "middle") {
        // Bats-first enforcement: boost batters when lineup is still thin
        const batterTarget = Math.ceil(
          starterTargets.batterStarters * CONTEXT.middle_bat_target_fraction,
        );
        if (player.type === "batter" && batterCount < batterTarget) {
          decisionScore += CONTEXT.middle_batter_thin_bonus;
          fitLabels.push("Lineup depth");
        }

        if (isSP && spCount < 2) {
          // Reduce SP pull when batting lineup is underbuilt
          const spBonus =
            batterCount >= batterTarget
              ? CONTEXT.middle_sp_built_bonus
              : CONTEXT.middle_sp_thin_bonus;
          decisionScore += spBonus;
          fitLabels.push("SP backbone");
        }

        if (isRP) {
          if (pitcherCount >= 4 && rpCount < 2) {
            decisionScore += CONTEXT.middle_rp_leverage;
            fitLabels.push("SV+H leverage");
          } else {
            decisionScore += CONTEXT.middle_rp_over_penalty;
          }
        }

        if (isC) {
          if ((openSlots.C ?? 0) > 0) {
            decisionScore += CONTEXT.middle_c_open_bonus;
            fitLabels.push("C slot open");
          } else if (batterCount < starterTargets.batterStarters - 2) {
            decisionScore += CONTEXT.middle_c_early_penalty;
            fitWarning =
              "Still early for catcher unless the value gap is obvious.";
          }
        }

        if (categoryProfile.weakSpeed && entry.strengths.includes("Speed")) {
          decisionScore += CONTEXT.middle_speed_patch;
          fitLabels.push("Steal patch");
        }

        if (categoryProfile.weakOps && entry.strengths.includes("OPS floor")) {
          decisionScore += CONTEXT.middle_ops_stabilizer;
          fitLabels.push("OPS stabilizer");
        }

        if (
          (categoryProfile.weakPower || batterCount < pitcherCount) &&
          entry.strengths.includes("Power")
        ) {
          decisionScore += CONTEXT.middle_power_support;
          fitLabels.push("Power support");
        }

        if (
          categoryProfile.weakRatios &&
          player.type === "pitcher" &&
          entry.strengths.includes("Ratios")
        ) {
          decisionScore += CONTEXT.middle_ratio_shield;
          fitLabels.push("Ratio shield");
        }
      }

      if (phase === "late") {
        if (isRP) {
          decisionScore +=
            rpCount < 3 ? CONTEXT.late_rp_first_3 : CONTEXT.late_rp_additional;
          fitLabels.push("SV+H patch");
        }

        if (isSP) {
          decisionScore +=
            categoryProfile.weakStrikeouts || categoryProfile.weakQs
              ? CONTEXT.late_sp_category_need
              : CONTEXT.late_sp_base;
          fitLabels.push("Streamable volume");
        }

        if (isC && (openSlots.C ?? 0) > 0) {
          decisionScore += CONTEXT.late_c_last_slot;
          fitLabels.push("Must-fill C slot");
          fitWarning = undefined;
        }

        if (player.type === "batter" && entry.strengths.includes("Speed")) {
          decisionScore += categoryProfile.weakSpeed
            ? CONTEXT.late_speed_weak
            : CONTEXT.late_speed_ok;
          fitLabels.push("Cheap speed");
        }

        if (player.type === "batter" && entry.strengths.includes("Power")) {
          decisionScore += categoryProfile.weakPower
            ? CONTEXT.late_power_weak
            : CONTEXT.late_power_ok;
          fitLabels.push("Bench thump");
        }
      }

      if (playerPositions.some((pos) => (openSlots[pos] ?? 0) > 0)) {
        decisionScore += CONTEXT.open_slot_bonus;
      } else if (player.type === "batter" && (openSlots.BAT_FLEX ?? 0) > 0) {
        decisionScore += CONTEXT.flex_slot_bonus;
      }

      if (
        (positionCounts[player.position] ?? 0) >= 2 &&
        player.position !== "OF"
      ) {
        decisionScore += CONTEXT.positional_crowd_penalty;
      }

      if (entry.caution && phase !== "late") {
        decisionScore += CONTEXT.caution_penalty;
      }

      // Positional scarcity bonus: if this player's tier at any eligible position is nearly
      // exhausted and the drop to the next tier is steep, reward taking them now.
      // Use the best bonus across all eligible positions so multi-position players
      // get credit for their most scarce slot.
      let bestScarcityBonus = 0;
      let bestScarcityLabel: string | null = null;
      for (const pos of playerPositions) {
        const { bonus, label } = getPositionalScarcityBonus(
          pos,
          player.tier,
          positionTierMap,
        );
        if (bonus > bestScarcityBonus) {
          bestScarcityBonus = bonus;
          bestScarcityLabel = label;
        }
      }
      if (bestScarcityBonus > 0) {
        decisionScore += bestScarcityBonus;
        if (bestScarcityLabel && fitLabels.length < 3) {
          fitLabels.push(bestScarcityLabel);
        }
      }

      // ADP availability modifier: penalize players well ahead of their ADP (safe
      // to wait), reward players past their ADP (genuine departure risk).
      const playerAdp = adpMap[player.id];
      if (playerAdp != null) {
        const adpBuffer = playerAdp - currentPick;
        if (adpBuffer > ADP_BUFFER.safe_threshold) {
          decisionScore += ADP_BUFFER.safe_penalty;
        } else if (adpBuffer > ADP_BUFFER.available_threshold) {
          decisionScore += ADP_BUFFER.available_penalty;
        } else if (adpBuffer < ADP_BUFFER.critical_threshold) {
          decisionScore += ADP_BUFFER.critical_bonus;
        } else if (adpBuffer < ADP_BUFFER.overdue_threshold) {
          decisionScore += ADP_BUFFER.overdue_bonus;
        }
      }

      if (fitLabels.length === 0) {
        fitLabels.push(phase === "late" ? "Upside swing" : "Board value");
      }

      return {
        ...entry,
        decisionScore: Math.max(0, Math.round(decisionScore)),
        fitLabels: fitLabels.slice(0, 3),
        fitWarning,
      };
    })
    .sort((left, right) => {
      if (right.decisionScore !== left.decisionScore) {
        return right.decisionScore - left.decisionScore;
      }
      if (right.draftScore !== left.draftScore) {
        return right.draftScore - left.draftScore;
      }
      return TIER_ORDER[left.player.tier] - TIER_ORDER[right.player.tier];
    });
}

function buildResourceUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(buildResourceUrl(path));
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function loadDraftData(): Promise<DraftData> {
  return loadJson<DraftData>("data/draft-data.json");
}

export function loadLeagueProfile(): Promise<LeagueProfile> {
  return loadJson<LeagueProfile>("data/league-profile.json");
}

export function loadEspnLeagueData(): Promise<EspnLeagueData> {
  return loadJson<EspnLeagueData>("data/espn-league-data.json");
}

export function loadEspnLeagueDataFresh(): Promise<EspnLeagueData> {
  const url = `${import.meta.env.BASE_URL}data/espn-league-data.json?t=${Date.now()}`;
  return fetch(url).then((res) => {
    if (!res.ok)
      throw new Error(`Failed to reload ESPN data: ${res.statusText}`);
    return res.json() as Promise<EspnLeagueData>;
  });
}

export function loadDraftHistory(): Promise<
  import("../lib/advice").DraftHistory
> {
  return loadJson("data/draft-history.json");
}

export interface ExpertRanking {
  rank: number;
  name: string;
  team: string;
  rank2025: number | null;
}

export function loadExpertRankings(): Promise<ExpertRanking[]> {
  return loadJson<ExpertRanking[]>("data/expert-rankings.json");
}

interface FangraphsInjuryEntry {
  name: string;
  status: string;
  notes: string;
  return_date: string;
}

interface FangraphsInjuries {
  players: FangraphsInjuryEntry[];
}

export function loadInjuries(): Promise<FangraphsInjuries> {
  return loadJson<FangraphsInjuries>("data/injuries.json");
}

// Merges Fangraphs injury data into players as a fallback when ESPN has no data.
// ESPN data always wins — this only fills gaps for players ESPN doesn't track.
export function mergeInjuryData(
  players: Player[],
  injuries: FangraphsInjuries,
): Player[] {
  const byName = new Map(
    injuries.players.map((e) => [normalizeName(e.name), e]),
  );
  return players.map((p) => {
    if (p.injured) return p; // ESPN already flagged this player
    const entry = byName.get(normalizeName(p.name));
    if (!entry) return p;
    const noteParts = [entry.notes, entry.return_date].filter(Boolean);
    return {
      ...p,
      injured: true,
      injuryStatus: "IL",
      notes: noteParts.length > 0 ? noteParts : undefined,
    };
  });
}

export function mergeExpertRankings(
  players: Player[],
  rankings: ExpertRanking[],
): Player[] {
  const byName = new Map(rankings.map((r) => [normalizeName(r.name), r.rank]));
  return players.map((p) => {
    const rank = byName.get(normalizeName(p.name));
    return rank != null ? { ...p, expertRank: rank } : p;
  });
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function mergeEspnInjuryStatus(
  players: Player[],
  espnData: EspnLeagueData,
): Player[] {
  const byName = new Map(
    espnData.availablePlayers
      .filter((p) => p.injuryStatus != null)
      .map((p) => [normalizeName(p.fullName), p.injuryStatus as string]),
  );
  // Also pull injury status from the autopick approximation list — some
  // injured players appear there but not in availablePlayers.
  for (const entry of espnData.autoPickApproximation) {
    if (entry.injuryStatus != null) {
      const key = normalizeName(entry.name);
      if (!byName.has(key)) {
        byName.set(key, entry.injuryStatus);
      }
    }
  }
  return players.map((p) => {
    const status = byName.get(normalizeName(p.name));
    if (status == null) return p;
    const injured = status !== "ACTIVE";
    return { ...p, injured, injuryStatus: injured ? status : undefined };
  });
}

function getPicksBeforeNextTurn(clock: DraftClock): number {
  // Walk through upcoming user picks and skip consecutive snake-turnaround
  // picks (e.g. picks 16 and 17 back-to-back) to find the real gap.
  let lastUserPick = clock.currentPick;
  for (const pick of clock.upcomingUserPicks) {
    if (pick <= lastUserPick) {
      continue;
    }
    if (pick > lastUserPick + 1) {
      return Math.max(0, pick - lastUserPick - 1);
    }
    lastUserPick = pick;
  }
  return 0;
}

// Lightweight name→ADP lookup built from ESPN data. Has no dependency on
// leagueClock or takenNames so it can be computed before contextualPlayers.
export function buildAdpMap(
  players: Player[],
  espnData: EspnLeagueData | null,
): Record<string, number> {
  if (!espnData) return {};
  const byName = new Map(
    espnData.autoPickApproximation
      .filter((e) => e.averageDraftPosition != null)
      .map((e) => [normalizeName(e.name), e.averageDraftPosition as number]),
  );
  return Object.fromEntries(
    players
      .map(
        (p) =>
          [p.id, byName.get(normalizeName(p.name))] as [
            string,
            number | undefined,
          ],
      )
      .filter((pair): pair is [string, number] => pair[1] != null),
  );
}

export function buildEspnAvailabilityMap(
  players: Player[],
  espnData: EspnLeagueData | null,
  clock: DraftClock,
  takenNames: Set<string> = new Set(),
): Record<string, EspnAvailabilitySignal> {
  if (!espnData) {
    return {};
  }

  const windowPicks = getPicksBeforeNextTurn(clock);

  // Build a relative-rank map based on the ESPN approximation order, skipping
  // players that are already taken/drafted. This ensures rank comparisons stay
  // meaningful after auto-simulation has consumed the top absolute ranks.
  let relativeRank = 0;
  const relativeRankByName = new Map<string, number>();
  for (const entry of espnData.autoPickApproximation) {
    const key = normalizeName(entry.name);
    if (!takenNames.has(key)) {
      relativeRank += 1;
      relativeRankByName.set(key, relativeRank);
    }
  }

  const byName = new Map(
    espnData.autoPickApproximation.map((entry) => [
      normalizeName(entry.name),
      entry,
    ]),
  );

  return Object.fromEntries(
    players.map((player) => {
      const key = normalizeName(player.name);
      const espnEntry = byName.get(key);

      if (!espnEntry) {
        return [
          player.id,
          {
            espnRank: null,
            adp: null,
            windowPicks,
            status: "unknown",
            note: "No ESPN draft-rank match found in the synced room data.",
          } satisfies EspnAvailabilitySignal,
        ];
      }

      const rank = relativeRankByName.get(key) ?? espnEntry.rank;

      // Screen-visibility threshold: the first ~20 players on ESPN's live board are
      // visible to every opponent on their default screen. Human managers draft from
      // what they can see — not in strict ESPN autopick order — so any player inside
      // this window can be taken at any time regardless of the pick-gap math.
      const SCREEN_VISIBLE_THRESHOLD = 20;

      // Expert-awareness threshold: players ranked in the top 25 by consensus expert
      // rankings are widely known in any competitive draft room. ESPN's autopick often
      // undervalues these players (especially pitchers with elite ratios or multi-skill
      // bats), but any prepared manager will be targeting them. A player ESPN ranks at
      // #28 who is Expert #13 is NOT safe — they're just mispriced by the autopick model.
      const EXPERT_KNOWN_THRESHOLD = 25;
      const expertKnown =
        player.expertRank != null &&
        player.expertRank <= EXPERT_KNOWN_THRESHOLD;

      let status: EspnAvailabilitySignal["status"] = "safe";
      let note =
        "Buried beyond typical screen visibility — unlikely to be targeted unless a run starts.";

      if (clock.isUserOnClock && rank <= 3) {
        status = "now";
        note =
          "Top ESPN autopick pressure right now. Do not assume this player comes back.";
      } else if (windowPicks === 0) {
        // No buffer — anything on screen or expert-known is at real risk.
        status =
          rank <= SCREEN_VISIBLE_THRESHOLD || expertKnown ? "fragile" : "safe";
        note =
          status === "fragile"
            ? expertKnown && rank > SCREEN_VISIBLE_THRESHOLD
              ? `Expert #${player.expertRank} — widely known in competitive rooms even if ESPN autopick ranks them lower (rank ${rank}). No pick buffer makes this a now-or-never call.`
              : `No picks before your next turn, and this player is visible on opponents' screens (ESPN rank ${rank}). Treat this as a now-or-never call.`
            : "No pick gap, and player is outside normal screen visibility.";
      } else if (rank <= windowPicks) {
        status = "swing";
        note = `Likely gone before your next turn if the room follows ESPN for the next ${windowPicks} picks.`;
      } else if (rank <= windowPicks + 6) {
        status = "fragile";
        note = `On the bubble for your next turn. One room run can wipe this out.`;
      } else if (rank <= SCREEN_VISIBLE_THRESHOLD) {
        // ESPN math says "safe" but this player is still on opponents' screens.
        status = "fragile";
        note = `ESPN rank ${rank} is outside the calculated danger window, but visible on opponents' screens. Human managers pick from what they see — treat as bubble, not safe.`;
      } else if (expertKnown) {
        // Outside ESPN's visible window but widely known via expert consensus.
        // ESPN autopick systematically undervalues certain player types (ratio aces,
        // multi-skill bats). Any manager who did their homework is targeting this player.
        status = "fragile";
        note = `Expert #${player.expertRank} — top-25 consensus ranking means prepared managers are hunting this player regardless of ESPN's autopick order (rank ${rank}). Do not assume they survive the round.`;
      }

      return [
        player.id,
        {
          espnRank: espnEntry.rank,
          adp: espnEntry.averageDraftPosition,
          windowPicks,
          status,
          note,
        } satisfies EspnAvailabilitySignal,
      ];
    }),
  );
}

export function filterByType<T extends EvaluatedPlayer>(
  players: T[],
  type: DraftViewFilter,
): T[] {
  if (type === "ALL") {
    return players;
  }
  return players.filter((entry) => entry.player.type === type);
}

export function searchPlayers<T extends EvaluatedPlayer>(
  players: T[],
  query: string,
): T[] {
  const normalized = normalizeName(query);
  if (!normalized) {
    return players;
  }

  return players.filter((entry) => {
    const haystack = normalizeName(
      [
        entry.player.name,
        entry.archetype,
        ...entry.strengths,
        ...entry.focusTags,
      ].join(" "),
    );
    return haystack.includes(normalized);
  });
}

export function filterByFocus<T extends EvaluatedPlayer>(
  players: T[],
  focus: FocusArea,
): T[] {
  if (focus === "ALL") {
    return players;
  }
  return players.filter((entry) => entry.focusTags.includes(focus));
}

function percentile(
  values: number[],
  value: number,
  higherIsBetter = true,
): number {
  if (values.length === 0) {
    return 0.5;
  }

  const sorted = [...values].sort((left, right) => left - right);
  let index = sorted.findIndex((candidate) => value <= candidate);
  if (index === -1) {
    index = sorted.length - 1;
  }
  const raw = sorted.length === 1 ? 1 : index / (sorted.length - 1);
  return higherIsBetter ? raw : 1 - raw;
}

function getPitcherExpertRankModifier(rank?: number): number {
  if (rank == null) return PITCHER_EXPERT_MODIFIERS.no_rank;
  if (rank <= 15) return PITCHER_EXPERT_MODIFIERS.top_15;
  if (rank <= 30) return PITCHER_EXPERT_MODIFIERS.top_30;
  if (rank <= 50) return PITCHER_EXPERT_MODIFIERS.top_50;
  return PITCHER_EXPERT_MODIFIERS.beyond;
}

function formatDecimal(value: number, digits = 3): string {
  return value.toFixed(digits);
}

// Returns how many decisionScore points to subtract based on injury severity.
// In H2H categories, a multi-month absence is not just a "hurt player" — it is a dead
// active roster slot through every matchup week until the player returns. The penalty
// must reflect that lost weekly contribution, not just abstract injury risk.
function getInjuryPenalty(
  status: string | undefined,
  notes: string[] | undefined,
): number {
  if (!status) return INJURY_PENALTIES.unknown;
  const s = status.toUpperCase();
  if (s === "DAY_TO_DAY") return INJURY_PENALTIES.day_to_day;
  if (s.includes("10") || s.includes("15")) return INJURY_PENALTIES.il_10_or_15;
  if (s.includes("60")) return INJURY_PENALTIES.il_60;
  const noteText = (notes ?? []).join(" ").toLowerCase();
  if (/august|september|\bmonths?\b/.test(noteText))
    return INJURY_PENALTIES.return_aug_sep;
  if (/july/.test(noteText)) return INJURY_PENALTIES.return_jul;
  if (/june/.test(noteText)) return INJURY_PENALTIES.return_jun;
  return INJURY_PENALTIES.generic_out;
}

// Returns a human-readable severity label that makes the H2H impact concrete.
function getInjurySeverityLabel(
  status: string | undefined,
  notes: string[] | undefined,
): string {
  if (!status) return "Injury — status unclear";
  const s = status.toUpperCase();
  if (s === "DAY_TO_DAY") return "Day-to-day";
  if (s.includes("10") || s.includes("15")) return "Short IL (10/15-day)";
  if (s.includes("60")) return "60-day IL — dead slot 2+ months";
  const noteText = (notes ?? []).join(" ").toLowerCase();
  if (/august|september/.test(noteText))
    return "Out Aug/Sep — near-season loss, IL stash only";
  if (/july/.test(noteText))
    return "Out until July — dead slot Apr–Jun (half H2H season)";
  if (/june/.test(noteText)) return "Out until June — dead slot Apr–May";
  return "OUT — duration unclear, likely 6+ weeks";
}

// Returns a 50/50 blend of 2025 actuals and Steamer projections for tier computation.
// Falls back to whichever is available if only one exists.
function blendBatting(
  player: Player,
): import("../types").BattingStats | undefined {
  const actual = player.batting;
  const proj = player.projections?.batting;
  if (actual && proj) {
    return {
      pa: (actual.pa + proj.pa) / 2,
      h: (actual.h + proj.h) / 2,
      r: (actual.r + proj.r) / 2,
      hr: (actual.hr + proj.hr) / 2,
      rbi: (actual.rbi + proj.rbi) / 2,
      sb: (actual.sb + proj.sb) / 2,
      avg: (actual.avg + proj.avg) / 2,
      obp: (actual.obp + proj.obp) / 2,
      slg: (actual.slg + proj.slg) / 2,
      ops: (actual.ops + proj.ops) / 2,
    };
  }
  return actual ?? proj;
}

function blendPitching(
  player: Player,
): import("../types").PitchingStats | undefined {
  const actual = player.pitching;
  const proj = player.projections?.pitching;
  if (actual && proj) {
    return {
      pa: (actual.pa + proj.pa) / 2,
      ip:
        actual.ip != null && proj.ip != null
          ? (actual.ip + proj.ip) / 2
          : (actual.ip ?? proj.ip),
      k: (actual.k + proj.k) / 2,
      kpct: (actual.kpct + proj.kpct) / 2,
      bbpct: (actual.bbpct + proj.bbpct) / 2,
      era: (actual.era + proj.era) / 2,
      whip: (actual.whip + proj.whip) / 2,
      qs:
        actual.qs != null && proj.qs != null
          ? (actual.qs + proj.qs) / 2
          : (actual.qs ?? proj.qs),
      svhd:
        actual.svhd != null && proj.svhd != null
          ? (actual.svhd + proj.svhd) / 2
          : (actual.svhd ?? proj.svhd),
    };
  }
  return actual ?? proj;
}

// Buckets a composite percentile score (0–1) into a display tier.
function scoreToTier(score: number): import("../types").Tier {
  if (score >= TIER_THRESHOLDS.ELITE) return "ELITE";
  if (score >= TIER_THRESHOLDS.T1) return "1";
  if (score >= TIER_THRESHOLDS.T2) return "2";
  if (score >= TIER_THRESHOLDS.T3) return "3";
  if (score >= TIER_THRESHOLDS.T4) return "4";
  return "5";
}

function evaluateBatter(player: Player, hitters: Player[]): EvaluatedPlayer {
  const stats = blendBatting(player);
  const usingProjections = player.projections?.batting != null;

  // All scoring — draftScore, tier, and decision score — use the same 50/50 blend
  // of 2025 actuals and Steamer projections. Falls back to whichever is available.
  const opsValues = hitters.map((h) => blendBatting(h)?.ops ?? 0);
  const hrValues = hitters.map((h) => blendBatting(h)?.hr ?? 0);
  const rValues = hitters.map((h) => blendBatting(h)?.r ?? 0);
  const rbiValues = hitters.map((h) => blendBatting(h)?.rbi ?? 0);
  const sbValues = hitters.map((h) => blendBatting(h)?.sb ?? 0);
  const hValues = hitters.map((h) => blendBatting(h)?.h ?? 0);
  const paValues = hitters.map((h) => blendBatting(h)?.pa ?? 0);

  const opsPct = percentile(opsValues, stats?.ops ?? 0);
  const hrPct = percentile(hrValues, stats?.hr ?? 0);
  const rPct = percentile(rValues, stats?.r ?? 0);
  const rbiPct = percentile(rbiValues, stats?.rbi ?? 0);
  const sbPct = percentile(sbValues, stats?.sb ?? 0);
  const hPct = percentile(hValues, stats?.h ?? 0);
  const paPct = percentile(paValues, stats?.pa ?? 0);

  // Weights reflect all 6 H2H scoring categories with approximately equal share.
  // H is slightly below the other counting stats since it overlaps with R/OPS.
  // PA is removed from scoring (not a category); it remains as a caution/label check only.
  const tierComposite =
    opsPct * BATTER_WEIGHTS.OPS +
    hrPct * BATTER_WEIGHTS.HR +
    rPct * BATTER_WEIGHTS.R +
    rbiPct * BATTER_WEIGHTS.RBI +
    sbPct * BATTER_WEIGHTS.SB +
    hPct * BATTER_WEIGHTS.H;

  const tier = scoreToTier(tierComposite);

  const age = player.age ?? 0;
  const agePenalty =
    age >= 37
      ? BATTER_AGE_PENALTIES.age_37_plus
      : age >= 35
        ? BATTER_AGE_PENALTIES.age_35_36
        : age >= 33
          ? BATTER_AGE_PENALTIES.age_33_34
          : 0;

  const draftScore = Math.round(
    (opsPct * BATTER_WEIGHTS.OPS +
      hrPct * BATTER_WEIGHTS.HR +
      rPct * BATTER_WEIGHTS.R +
      rbiPct * BATTER_WEIGHTS.RBI +
      sbPct * BATTER_WEIGHTS.SB +
      hPct * BATTER_WEIGHTS.H) *
      100 -
      agePenalty,
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const focusTags: FocusArea[] = ["ALL"];

  if (opsPct >= BATTER_THRESHOLDS.strength_pct) {
    strengths.push("OPS floor");
    focusTags.push("floor");
  }
  if (hrPct >= BATTER_THRESHOLDS.strength_pct) {
    strengths.push("Power");
    focusTags.push("power");
  }
  if (sbPct >= BATTER_THRESHOLDS.strength_pct) {
    strengths.push("Speed");
    focusTags.push("speed");
  }
  if (
    rPct >= BATTER_THRESHOLDS.strength_pct ||
    rbiPct >= BATTER_THRESHOLDS.strength_pct
  ) {
    strengths.push("Run production");
  }
  if (paPct < BATTER_THRESHOLDS.weakness_pa_pct) {
    weaknesses.push("Lighter volume");
    focusTags.push("upside");
  }
  if (age >= 35) {
    weaknesses.push(`Age ${age} decline risk`);
  }

  let archetype = "Balanced bat";
  if (player.pitching) {
    archetype = "Two-way player";
  } else if (
    hrPct >= BATTER_THRESHOLDS.anchor_threshold &&
    opsPct >= BATTER_THRESHOLDS.anchor_threshold
  ) {
    archetype = "Middle-order anchor";
  } else if (sbPct >= BATTER_THRESHOLDS.speed_archetype) {
    archetype = "Speed pressure bat";
  } else if (opsPct >= BATTER_THRESHOLDS.ops_archetype) {
    archetype = "OPS stabilizer";
  } else if (hrPct >= BATTER_THRESHOLDS.power_archetype) {
    archetype = "Power patch";
  }

  const caution =
    stats && stats.pa < BATTER_THRESHOLDS.pa_short_season
      ? "Playing-time volume is lighter than a full-season anchor."
      : stats && stats.pa < BATTER_THRESHOLDS.pa_partial_season
        ? "Missed significant time — durability risk at premium pick cost."
        : undefined;

  const opsLabel = usingProjections ? "OPS (blend)" : "OPS";
  const displayBatting = player.batting;

  return {
    player: { ...player, tier },
    draftScore,
    archetype,
    strengths,
    weaknesses,
    focusTags,
    caution,
    primaryStat: {
      label: opsLabel,
      value: stats ? formatDecimal(stats.ops) : "—",
    },
    secondaryStats: [
      {
        label: usingProjections ? "HR (blend)" : "HR",
        value: `${stats?.hr ?? 0}`,
      },
      {
        label: usingProjections ? "SB (blend)" : "SB",
        value: `${stats?.sb ?? 0}`,
      },
      {
        label: usingProjections ? "R (blend)" : "R",
        value: `${stats?.r ?? 0}`,
      },
      {
        label: usingProjections ? "RBI (blend)" : "RBI",
        value: `${stats?.rbi ?? displayBatting?.rbi ?? 0}`,
      },
      ...(player.pitching
        ? [
            { label: "ERA", value: player.pitching.era.toFixed(2) },
            { label: "K", value: `${player.pitching.k}` },
            { label: "WHIP", value: player.pitching.whip.toFixed(2) },
          ]
        : []),
    ],
  };
}

function evaluatePitcher(player: Player, pitchers: Player[]): EvaluatedPlayer {
  const stats = blendPitching(player);
  const usingProjections = player.projections?.pitching != null;
  const isRP = player.position === "RP";

  // All scoring — draftScore, tier, and decision score — use the same 50/50 blend
  // of 2025 actuals and Steamer projections. Falls back to whichever is available.
  const kValues = pitchers.map((p) => blendPitching(p)?.k ?? 0);
  const eraValues = pitchers.map((p) => blendPitching(p)?.era ?? 9);
  const whipValues = pitchers.map((p) => blendPitching(p)?.whip ?? 3);
  const paValues = pitchers.map((p) => blendPitching(p)?.pa ?? 0);
  const qsValues = pitchers.map((p) => blendPitching(p)?.qs ?? 0);
  const svhdValues = pitchers.map((p) => blendPitching(p)?.svhd ?? 0);

  const kPct = percentile(kValues, stats?.k ?? 0);
  const eraPct = percentile(eraValues, stats?.era ?? 9, false);
  const whipPct = percentile(whipValues, stats?.whip ?? 3, false);
  const volumePct = percentile(paValues, stats?.pa ?? 0);
  const qsPct = percentile(qsValues, stats?.qs ?? 0);
  const svhdPct = percentile(svhdValues, stats?.svhd ?? 0);

  const tierComposite = isRP
    ? svhdPct * 0.55 + eraPct * 0.2 + whipPct * 0.2 + kPct * 0.05
    : kPct * 0.28 +
      eraPct * 0.22 +
      whipPct * 0.22 +
      qsPct * 0.2 +
      volumePct * 0.08;

  const tier = scoreToTier(tierComposite);

  // SP: K, ERA, WHIP, QS are the 4 scoring categories — weight them equally with K
  // slightly higher as the most differentiating SP stat. Volume (PA) is a durability
  // proxy used for tier but not for the per-category scoring score.
  const age = player.age ?? 0;
  const agePenalty = age >= 37 ? 12 : age >= 35 ? 7 : age >= 33 ? 2 : 0;

  const draftScore = isRP
    ? Math.round(
        // SVHD is the primary RP category in H2H — closers' 65 IP barely moves
        // ERA/WHIP vs. the 170+ IP from SPs already covering those lines.
        // Weight SVHD heavily; keep ratios as a meaningful but secondary signal.
        (svhdPct * 0.55 + eraPct * 0.2 + whipPct * 0.2 + kPct * 0.05) * 100,
      )
    : Math.round(
        (kPct * 0.28 + eraPct * 0.24 + whipPct * 0.24 + qsPct * 0.24) * 100 -
          agePenalty,
      );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const focusTags: FocusArea[] = ["ALL"];

  if (isRP) {
    if (svhdPct >= 0.7) {
      strengths.push("Saves+Holds");
      focusTags.push("floor");
    }
    if (eraPct >= 0.66 || whipPct >= 0.66) {
      strengths.push("Ratios");
      focusTags.push("ratios");
    }
    if (kPct >= 0.7) {
      strengths.push("Strikeouts");
      focusTags.push("power");
    }
    if (svhdPct < 0.4) {
      weaknesses.push("Limited saves/holds role");
    }
    if (age >= 35) {
      weaknesses.push(`Age ${age} decline risk`);
    }
  } else {
    if (kPct >= 0.7) {
      strengths.push("Strikeouts");
      focusTags.push("power");
    }
    if (eraPct >= 0.66 || whipPct >= 0.66) {
      strengths.push("Ratios");
      focusTags.push("ratios");
      focusTags.push("floor");
    }
    if (qsPct >= 0.68) {
      strengths.push("QS volume");
    }
    if (volumePct < 0.32) {
      weaknesses.push("Lighter workload");
      focusTags.push("upside");
    }
    if (age >= 35) {
      weaknesses.push(`Age ${age} decline risk`);
    }
  }

  let archetype: string;
  if (isRP) {
    if (svhdPct >= 0.75 && (eraPct >= 0.65 || whipPct >= 0.65)) {
      archetype = "Closer/setup anchor";
    } else if (svhdPct >= 0.65) {
      archetype = "SV+H contributor";
    } else {
      archetype = "Bullpen depth";
    }
  } else if (kPct >= 0.72 && eraPct >= 0.7 && whipPct >= 0.7) {
    archetype = "Ratio ace";
  } else if (kPct >= 0.74) {
    archetype = "Strikeout engine";
  } else if (eraPct >= 0.72 && whipPct >= 0.72) {
    archetype = "Ratio stabilizer";
  } else if (qsPct >= 0.7) {
    archetype = "Innings anchor";
  } else {
    archetype = "Rotation depth";
  }

  const caution =
    !isRP && stats && stats.pa < 140
      ? "Volume is lighter, so strikeout and QS totals may lag a true ace."
      : undefined;

  const kLabel = usingProjections ? "K (blend)" : "K";

  return {
    player: { ...player, tier },
    draftScore,
    archetype,
    strengths,
    weaknesses,
    focusTags,
    caution,
    primaryStat: {
      label: isRP ? (usingProjections ? "SVHD (blend)" : "SVHD") : kLabel,
      value: isRP ? `${stats?.svhd ?? 0}` : `${stats?.k ?? 0}`,
    },
    secondaryStats: isRP
      ? [
          {
            label: usingProjections ? "ERA (blend)" : "ERA",
            value: stats ? stats.era.toFixed(2) : "—",
          },
          {
            label: usingProjections ? "WHIP (blend)" : "WHIP",
            value: stats ? formatDecimal(stats.whip) : "—",
          },
          {
            label: usingProjections ? "K (blend)" : "K",
            value: `${stats?.k ?? 0}`,
          },
        ]
      : [
          {
            label: usingProjections ? "QS (blend)" : "QS",
            value: `${stats?.qs ?? 0}`,
          },
          {
            label: usingProjections ? "ERA (blend)" : "ERA",
            value: stats ? stats.era.toFixed(2) : "—",
          },
          {
            label: usingProjections ? "WHIP (blend)" : "WHIP",
            value: stats ? formatDecimal(stats.whip) : "—",
          },
        ],
  };
}

export function evaluatePlayers(players: Player[]): EvaluatedPlayer[] {
  const hitters = players.filter((player) => player.type === "batter");
  const pitchers = players.filter((player) => player.type === "pitcher");

  return players
    .map((player) =>
      player.type === "batter"
        ? evaluateBatter(player, hitters)
        : evaluatePitcher(player, pitchers),
    )
    .sort((left, right) => right.draftScore - left.draftScore);
}

export function buildDraftClock(
  currentPick: number,
  teams: number,
  userSlot: number,
  totalPicks: number,
): DraftClock {
  const safePick = Math.max(1, Math.min(currentPick, totalPicks));
  const currentRound = Math.ceil(safePick / teams);
  const roundPick = safePick - (currentRound - 1) * teams;
  const upcomingUserPicks: number[] = [];

  for (let round = 1; round <= Math.ceil(totalPicks / teams); round += 1) {
    const slot = round % 2 === 1 ? userSlot : teams - userSlot + 1;
    const overallPick = (round - 1) * teams + slot;
    if (overallPick >= safePick && overallPick <= totalPicks) {
      upcomingUserPicks.push(overallPick);
    }
  }

  const nextUserPick = upcomingUserPicks[0] ?? null;

  return {
    currentPick: safePick,
    currentRound,
    roundPick,
    isUserOnClock: nextUserPick === safePick,
    nextUserPick,
    picksUntilUser:
      nextUserPick === null ? null : Math.max(0, nextUserPick - safePick),
    upcomingUserPicks: upcomingUserPicks.slice(0, 4),
  };
}

function detectAvailableCategory(
  players: Player[],
  accessor: (player: Player) => number | undefined,
): boolean {
  const values = players
    .map(accessor)
    .filter((value): value is number => typeof value === "number");
  return values.some((value) => value !== 0);
}

export function buildCategoryMeters(
  draftedPlayers: Player[],
  allPlayers: Player[],
): CategoryMeter[] {
  const availability = {
    H: detectAvailableCategory(allPlayers, (player) => player.batting?.h),
    R: detectAvailableCategory(allPlayers, (player) => player.batting?.r),
    HR: detectAvailableCategory(allPlayers, (player) => player.batting?.hr),
    RBI: detectAvailableCategory(allPlayers, (player) => player.batting?.rbi),
    SB: detectAvailableCategory(allPlayers, (player) => player.batting?.sb),
    OPS: detectAvailableCategory(allPlayers, (player) => player.batting?.ops),
    K: detectAvailableCategory(allPlayers, (player) => player.pitching?.k),
    QS: detectAvailableCategory(allPlayers, (player) => player.pitching?.qs),
    ERA: detectAvailableCategory(allPlayers, (player) => player.pitching?.era),
    WHIP: detectAvailableCategory(
      allPlayers,
      (player) => player.pitching?.whip,
    ),
    SVHD: detectAvailableCategory(
      allPlayers,
      (player) => player.pitching?.svhd,
    ),
  };

  const draftedBatters = draftedPlayers.filter(
    (player) => player.type === "batter",
  );
  const draftedPitchers = draftedPlayers.filter(
    (player) => player.type === "pitcher",
  );
  const avgOps =
    draftedBatters.length > 0
      ? draftedBatters.reduce(
          (sum, player) => sum + (player.batting?.ops ?? 0),
          0,
        ) / draftedBatters.length
      : null;
  const avgEra =
    draftedPitchers.length > 0
      ? draftedPitchers.reduce(
          (sum, player) => sum + (player.pitching?.era ?? 0),
          0,
        ) / draftedPitchers.length
      : null;
  const avgWhip =
    draftedPitchers.length > 0
      ? draftedPitchers.reduce(
          (sum, player) => sum + (player.pitching?.whip ?? 0),
          0,
        ) / draftedPitchers.length
      : null;

  return [
    {
      id: "H",
      label: "Hits",
      support: availability.H ? "available" : "missing",
      trend: "higher",
      value: draftedBatters.reduce(
        (sum, player) => sum + (player.batting?.h ?? 0),
        0,
      ),
      display: `${draftedBatters.reduce((sum, player) => sum + (player.batting?.h ?? 0), 0)}`,
      note: availability.H
        ? "Directional volume from drafted hitters."
        : "Current source feed does not support this category.",
    },
    {
      id: "R",
      label: "Runs",
      support: availability.R ? "available" : "missing",
      trend: "higher",
      value: availability.R
        ? draftedBatters.reduce(
            (sum, player) => sum + (player.batting?.r ?? 0),
            0,
          )
        : null,
      display: availability.R
        ? `${draftedBatters.reduce((sum, player) => sum + (player.batting?.r ?? 0), 0)}`
        : "—",
      note: availability.R
        ? "Supported by imported data."
        : "Runs are not populated in the current source export.",
    },
    {
      id: "HR",
      label: "Home Runs",
      support: availability.HR ? "available" : "missing",
      trend: "higher",
      value: draftedBatters.reduce(
        (sum, player) => sum + (player.batting?.hr ?? 0),
        0,
      ),
      display: `${draftedBatters.reduce((sum, player) => sum + (player.batting?.hr ?? 0), 0)}`,
      note: availability.HR
        ? "One of the cleaner offensive inputs in the current feed."
        : "Current source feed does not support this category.",
    },
    {
      id: "RBI",
      label: "RBI",
      support: availability.RBI ? "available" : "missing",
      trend: "higher",
      value: availability.RBI
        ? draftedBatters.reduce(
            (sum, player) => sum + (player.batting?.rbi ?? 0),
            0,
          )
        : null,
      display: availability.RBI
        ? `${draftedBatters.reduce((sum, player) => sum + (player.batting?.rbi ?? 0), 0)}`
        : "—",
      note: availability.RBI
        ? "Supported by imported data."
        : "RBI values are not populated in the current source export.",
    },
    {
      id: "SB",
      label: "Steals",
      support: availability.SB ? "available" : "missing",
      trend: "higher",
      value: draftedBatters.reduce(
        (sum, player) => sum + (player.batting?.sb ?? 0),
        0,
      ),
      display: `${draftedBatters.reduce((sum, player) => sum + (player.batting?.sb ?? 0), 0)}`,
      note: availability.SB
        ? "Useful for identifying speed patches later in the draft."
        : "Current source feed does not support this category.",
    },
    {
      id: "OPS",
      label: "OPS",
      support: availability.OPS ? "available" : "missing",
      trend: "higher",
      value: avgOps,
      display: avgOps === null ? "—" : avgOps.toFixed(3),
      note: availability.OPS
        ? "Best offensive floor signal in the current feed."
        : "Current source feed does not support this category.",
    },
    {
      id: "K",
      label: "Strikeouts",
      support: availability.K ? "available" : "missing",
      trend: "higher",
      value: draftedPitchers.reduce(
        (sum, player) => sum + (player.pitching?.k ?? 0),
        0,
      ),
      display: `${draftedPitchers.reduce((sum, player) => sum + (player.pitching?.k ?? 0), 0)}`,
      note: availability.K
        ? "Good directional proxy for starting-pitching strength."
        : "Current source feed does not support this category.",
    },
    {
      id: "QS",
      label: "Quality Starts",
      support: availability.QS ? "available" : "missing",
      trend: "higher",
      value: availability.QS
        ? draftedPitchers.reduce(
            (sum, player) => sum + (player.pitching?.qs ?? 0),
            0,
          )
        : null,
      display: availability.QS
        ? `${draftedPitchers.reduce((sum, player) => sum + (player.pitching?.qs ?? 0), 0)}`
        : "—",
      note: availability.QS
        ? "Supported by imported data."
        : "QS are not populated in the current source export.",
    },
    {
      id: "ERA",
      label: "ERA",
      support: availability.ERA ? "available" : "missing",
      trend: "lower",
      value: avgEra,
      display: avgEra === null ? "—" : avgEra.toFixed(2),
      note: availability.ERA
        ? "Lower is better. Use as a ratio guardrail."
        : "Current source feed does not support this category.",
    },
    {
      id: "WHIP",
      label: "WHIP",
      support: availability.WHIP ? "available" : "missing",
      trend: "lower",
      value: avgWhip,
      display: avgWhip === null ? "—" : avgWhip.toFixed(3),
      note: availability.WHIP
        ? "Lower is better. Good way to avoid ratio traps."
        : "Current source feed does not support this category.",
    },
    {
      id: "SVHD",
      label: "SV+H",
      support: availability.SVHD ? "available" : "missing",
      trend: "higher",
      value: availability.SVHD
        ? draftedPitchers.reduce(
            (sum, player) => sum + (player.pitching?.svhd ?? 0),
            0,
          )
        : null,
      display: availability.SVHD
        ? `${draftedPitchers.reduce((sum, player) => sum + (player.pitching?.svhd ?? 0), 0)}`
        : "—",
      note: availability.SVHD
        ? "Supported by imported data."
        : "Save-plus-hold values are not populated in the current source export.",
    },
  ];
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function summarizeRoster(draftedPlayers: Player[]): {
  total: number;
  batters: number;
  pitchers: number;
  averageScoreTier: string;
} {
  const batters = draftedPlayers.filter(
    (player) => player.type === "batter",
  ).length;
  const pitchers = draftedPlayers.filter(
    (player) => player.type === "pitcher",
  ).length;

  let averageScoreTier = "No core built yet";
  if (draftedPlayers.length > 0) {
    const tierAverage =
      draftedPlayers.reduce(
        (sum, player) => sum + (6 - TIER_ORDER[player.tier]),
        0,
      ) / draftedPlayers.length;
    if (tierAverage >= 5.25) {
      averageScoreTier = "Elite spine";
    } else if (tierAverage >= 4.4) {
      averageScoreTier = "Strong foundation";
    } else if (tierAverage >= 3.3) {
      averageScoreTier = "Functional core";
    } else {
      averageScoreTier = "Needs premium talent";
    }
  }

  return {
    total: draftedPlayers.length,
    batters,
    pitchers,
    averageScoreTier,
  };
}
