import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EspnLeagueData,
  LeagueConfig,
  LeagueProfile,
  Player,
  RosterSlot,
} from "../types";
import type {
  AutoRunBatch,
  DraftedRecord,
  NeedCard,
  TakenRecord,
} from "../types";
import {
  applyDraftContext,
  buildAdpMap,
  buildCategoryMeters,
  buildDraftClock,
  buildEspnAvailabilityMap,
  loadInjuries,
  mergeInjuryData,
  buildStrategySnapshot,
  evaluatePlayers,
  filterByFocus,
  filterByType,
  getPlayerPositions,
  loadDraftData,
  loadDraftHistory,
  loadEspnLeagueData,
  loadEspnLeagueDataFresh,
  loadExpertRankings,
  loadLeagueProfile,
  mergeEspnInjuryStatus,
  mergeExpertRankings,
  normalizeName,
  searchPlayers,
  type ContextualPlayer,
  type DraftViewFilter,
  type EspnAvailabilitySignal,
  type FocusArea,
} from "../lib/data";
import { buildAdvicePrompt, type DraftHistory } from "../lib/advice";
import { useLiveSync } from "../hooks/useLiveSync";
import { usePromptCopy } from "../hooks/usePromptCopy";
import BoardSidebar from "./BoardSidebar";
import BoardMain, { type BoardSection } from "./BoardMain";
import IntelPanel from "./IntelPanel";

const STORAGE_KEY = "fantasy-draft-dashboard-state-v3";

interface PersistedState {
  currentPick: number | null;
  queueIds: string[];
  drafted: DraftedRecord[];
  taken: TakenRecord[];
  strategyNotes: string;
  lastAutoRunBatch: AutoRunBatch | null;
}

function loadPersistedState(): PersistedState {
  if (typeof window === "undefined") {
    return {
      currentPick: null,
      queueIds: [],
      drafted: [],
      taken: [],
      strategyNotes: "",
      lastAutoRunBatch: null,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        currentPick: null,
        queueIds: [],
        drafted: [],
        taken: [],
        strategyNotes: "",
        lastAutoRunBatch: null,
      };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      currentPick: parsed.currentPick ?? null,
      queueIds: parsed.queueIds ?? [],
      drafted: parsed.drafted ?? [],
      taken: parsed.taken ?? [],
      strategyNotes: parsed.strategyNotes ?? "",
      lastAutoRunBatch: parsed.lastAutoRunBatch ?? null,
    };
  } catch {
    return {
      currentPick: null,
      queueIds: [],
      drafted: [],
      taken: [],
      strategyNotes: "",
      lastAutoRunBatch: null,
    };
  }
}

function isBenchSlot(slot: RosterSlot): boolean {
  return (
    slot.id.toLowerCase().startsWith("bench") ||
    slot.label.toLowerCase().includes("bench")
  );
}

function buildNeedCards(
  draftedPlayers: Player[],
  rosterSlots: RosterSlot[],
  categorySummaries: Array<{ label: string; display: string; note: string }>,
): NeedCard[] {
  const starterSlots = rosterSlots.filter((slot) => !isBenchSlot(slot));
  const hitterStarterCount = starterSlots.filter(
    (slot) => slot.type === "batter",
  ).length;
  const pitcherStarterCount = starterSlots.filter(
    (slot) => slot.type === "pitcher",
  ).length;
  const draftedBatters = draftedPlayers.filter((p) => p.type === "batter");
  const draftedSp = draftedPlayers.filter((p) =>
    getPlayerPositions(p).includes("SP"),
  );
  const draftedRp = draftedPlayers.filter((p) =>
    getPlayerPositions(p).includes("RP"),
  );

  const urgentOpenSlots = rosterSlots
    .filter((slot) => !isBenchSlot(slot))
    .reduce<Record<string, number>>((counts, slot) => {
      const label = slot.label.startsWith("OF")
        ? "OF"
        : slot.label.startsWith("SP")
          ? "SP"
          : slot.label.startsWith("RP")
            ? "RP"
            : slot.label.startsWith("UTIL")
              ? "UTIL"
              : slot.label;
      counts[label] = (counts[label] ?? 0) + 1;
      return counts;
    }, {});

  draftedPlayers.forEach((player) => {
    const positions = getPlayerPositions(player);
    for (const pos of positions) {
      if ((urgentOpenSlots[pos] ?? 0) > 0) {
        urgentOpenSlots[pos] -= 1;
        return;
      }
    }
    if (player.type === "batter" && (urgentOpenSlots.UTIL ?? 0) > 0) {
      urgentOpenSlots.UTIL -= 1;
      return;
    }
    if (positions.includes("OF") && (urgentOpenSlots.OF ?? 0) > 0) {
      urgentOpenSlots.OF -= 1;
      return;
    }
    if (positions.includes("SP") && (urgentOpenSlots.SP ?? 0) > 0) {
      urgentOpenSlots.SP -= 1;
      return;
    }
    if (positions.includes("RP") && (urgentOpenSlots.RP ?? 0) > 0) {
      urgentOpenSlots.RP -= 1;
    }
  });

  const openPositions = Object.entries(urgentOpenSlots)
    .filter(([, count]) => count > 0)
    .sort((l, r) => r[1] - l[1])
    .slice(0, 3)
    .map(([label, count]) => `${label} x${count}`);

  const needs: NeedCard[] = [
    {
      title: "Hitters in place",
      value: `${draftedBatters.length}/${hitterStarterCount}`,
      detail:
        draftedBatters.length < Math.ceil(hitterStarterCount * 0.5)
          ? "Still building offensive volume. Do not let the room push you into pitching-only turns."
          : "Offensive shell is forming. Protect category balance, not just player quality.",
      tone:
        draftedBatters.length < Math.ceil(hitterStarterCount * 0.35)
          ? "urgent"
          : draftedBatters.length < Math.ceil(hitterStarterCount * 0.6)
            ? "watch"
            : "stable",
    },
    {
      title: "SP backbone",
      value: `${draftedSp.length}/${Math.min(4, pitcherStarterCount)}`,
      detail:
        draftedSp.length < 2
          ? "QS leagues punish thin rotations. Secure dependable starters before the room forces volume arms on you."
          : "You have a usable spine. Add more only if the value or category fit is clean.",
      tone:
        draftedSp.length < 2
          ? "urgent"
          : draftedSp.length < 3
            ? "watch"
            : "stable",
    },
    {
      title: "RP base",
      value: `${draftedRp.length}/3`,
      detail:
        draftedRp.length === 0
          ? "No relievers yet is fine early, but SV+H still needs a late plan."
          : draftedRp.length < 2
            ? "You have started the relief base. Stay patient unless the room is clearly draining ratio-safe options."
            : "Relief floor is in place. Do not keep paying for the category unless the value is obvious.",
      tone: draftedRp.length < 2 ? "watch" : "stable",
    },
    {
      title: "Most open spots",
      value:
        openPositions.length > 0
          ? openPositions.join(" • ")
          : "Core starters covered",
      detail:
        openPositions.length > 0
          ? "Use this only as a tiebreaker. In a shallow league, category advantage still matters more than position labels."
          : "You can draft more freely now and chase category leverage over positional cleanup.",
      tone: openPositions.length > 0 ? "watch" : "stable",
    },
  ];

  return needs.concat(
    categorySummaries.slice(0, 2).map((cat) => ({
      title: cat.label,
      value: cat.display,
      detail: cat.note,
      tone: "watch" as const,
    })),
  );
}

export default function DraftTool() {
  const persisted = loadPersistedState();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<LeagueProfile | null>(null);
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [espnData, setEspnData] = useState<EspnLeagueData | null>(null);
  const [draftHistory, setDraftHistory] = useState<DraftHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Draft state ──────────────────────────────────────────────────────────────
  const [currentPick, setCurrentPick] = useState<number | null>(
    persisted.currentPick,
  );
  const [queueIds, setQueueIds] = useState<string[]>(persisted.queueIds);
  const [drafted, setDrafted] = useState<DraftedRecord[]>(persisted.drafted);
  const [taken, setTaken] = useState<TakenRecord[]>(persisted.taken);
  const [strategyNotes, setStrategyNotes] = useState(persisted.strategyNotes);
  const [lastAutoRunBatch, setLastAutoRunBatch] = useState<AutoRunBatch | null>(
    persisted.lastAutoRunBatch,
  );

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"board" | "intel">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<DraftViewFilter>("ALL");
  const [focusArea, setFocusArea] = useState<FocusArea>("ALL");
  const [queueOnly, setQueueOnly] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [syncCopyStatus, setSyncCopyStatus] = useState<
    "idle" | "syncing" | "copied" | "error"
  >("idle");

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const {
    liveSyncEnabled,
    setLiveSyncEnabled,
    liveSyncStatus,
    liveSyncLastAt,
  } = useLiveSync(setEspnData, setCurrentPick);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadDraftData(),
      loadLeagueProfile(),
      loadEspnLeagueData().catch(() => null),
      loadDraftHistory().catch(() => null),
      loadExpertRankings().catch(() => null),
      loadInjuries().catch(() => null),
    ])
      .then(
        ([
          draftData,
          leagueProfile,
          syncedEspnData,
          history,
          expertRankings,
          injuryData,
        ]) => {
          const syncedCurrentPick = syncedEspnData
            ? (syncedEspnData.draftPicks.filter((p) => p.playerId > 0).length ||
                0) + 1
            : null;
          let mergedPlayers = expertRankings
            ? mergeExpertRankings(draftData.players, expertRankings)
            : draftData.players;
          if (syncedEspnData)
            mergedPlayers = mergeEspnInjuryStatus(
              mergedPlayers,
              syncedEspnData,
            );
          if (injuryData)
            mergedPlayers = mergeInjuryData(mergedPlayers, injuryData);
          setPlayers(mergedPlayers);
          setProfile(leagueProfile);
          setLeagueConfig(draftData.league);
          setEspnData(syncedEspnData);
          setDraftHistory(history);
          setCurrentPick(
            (prev) =>
              prev ??
              syncedCurrentPick ??
              draftData.league.draftInfo.pickNumber,
          );
        },
      )
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load draft dashboard data.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentPick,
        queueIds,
        drafted,
        taken,
        strategyNotes,
        lastAutoRunBatch,
      } satisfies PersistedState),
    );
  }, [currentPick, drafted, lastAutoRunBatch, queueIds, taken, strategyNotes]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const evaluatedPlayers = useMemo(() => evaluatePlayers(players), [players]);
  const evaluatedById = useMemo(
    () =>
      Object.fromEntries(
        evaluatedPlayers.map((e) => [e.player.id, e]),
      ) as Record<string, ContextualPlayer>,
    [evaluatedPlayers],
  );
  const draftedSet = useMemo(
    () => new Set(drafted.map((r) => r.playerId)),
    [drafted],
  );
  const espnTakenSet = useMemo(
    () =>
      new Set(
        (espnData?.draftPicks ?? [])
          .filter((p) => p.playerId > 0)
          .map((p) => p.playerId),
      ),
    [espnData],
  );
  const takenSet = useMemo(
    () => new Set(taken.map((r) => r.playerId)),
    [taken],
  );

  const draftedPlayers = useMemo(
    () =>
      drafted
        .map((r) => evaluatedById[r.playerId]?.player)
        .filter((p): p is Player => Boolean(p)),
    [drafted, evaluatedById],
  );

  const adpMap = useMemo(
    () => buildAdpMap(players, espnData),
    [players, espnData],
  );

  const contextualPlayers = useMemo<ContextualPlayer[]>(() => {
    if (!leagueConfig || !profile) {
      return evaluatedPlayers.map((e) => ({
        ...e,
        decisionScore: e.draftScore,
        fitLabels: [e.archetype],
      }));
    }
    const pickForScoring =
      currentPick ?? leagueConfig.draftInfo.pickNumber ?? 1;
    return applyDraftContext(
      evaluatedPlayers,
      draftedPlayers,
      players,
      leagueConfig,
      profile.rosterSlots,
      pickForScoring,
      adpMap,
    );
  }, [
    adpMap,
    currentPick,
    draftedPlayers,
    evaluatedPlayers,
    leagueConfig,
    players,
    profile,
  ]);

  const contextualById = useMemo(
    () =>
      Object.fromEntries(
        contextualPlayers.map((e) => [e.player.id, e]),
      ) as Record<string, ContextualPlayer>,
    [contextualPlayers],
  );

  const queuePlayers = useMemo(
    () =>
      queueIds
        .map((id) => contextualById[id])
        .filter((p): p is ContextualPlayer => Boolean(p)),
    [contextualById, queueIds],
  );

  const takenPlayers = useMemo(() => {
    const localTaken = taken
      .map((r) => ({ record: r, player: contextualById[r.playerId]?.player }))
      .filter((e): e is { record: TakenRecord; player: Player } =>
        Boolean(e.player),
      );

    const syncedTaken = (espnData?.draftPicks ?? [])
      .filter((p) => p.playerId > 0)
      .map((p) => {
        const matched = players.find((pl) => pl.mlbId === p.playerId);
        return matched
          ? {
              record: {
                playerId: matched.id,
                takenAtPick: p.overallPickNumber,
              },
              player: matched,
            }
          : null;
      })
      .filter((e): e is { record: TakenRecord; player: Player } => Boolean(e));

    const deduped = new Map<string, { record: TakenRecord; player: Player }>();
    [...syncedTaken, ...localTaken].forEach((e) => {
      if (!deduped.has(e.player.id)) deduped.set(e.player.id, e);
    });
    return [...deduped.values()].sort(
      (l, r) => r.record.takenAtPick - l.record.takenAtPick,
    );
  }, [contextualById, espnData, players, taken]);

  const availablePlayers = useMemo(
    () =>
      contextualPlayers.filter(
        (e) =>
          !draftedSet.has(e.player.id) &&
          !takenSet.has(e.player.id) &&
          !(e.player.mlbId && espnTakenSet.has(e.player.mlbId)),
      ),
    [contextualPlayers, draftedSet, espnTakenSet, takenSet],
  );

  const filteredPlayers = useMemo(() => {
    const byType = filterByType(availablePlayers, selectedType);
    const byFocus = filterByFocus(byType, focusArea);
    const bySearch = searchPlayers(byFocus, searchQuery);
    if (queueOnly) {
      const queuedSet = new Set(queueIds);
      return bySearch.filter((e) => queuedSet.has(e.player.id));
    }
    return bySearch;
  }, [
    availablePlayers,
    focusArea,
    queueIds,
    queueOnly,
    searchQuery,
    selectedType,
  ]);

  const categoryMeters = buildCategoryMeters(draftedPlayers, players);
  const safeCurrentPick =
    currentPick ?? leagueConfig?.draftInfo.pickNumber ?? 1;
  const leagueClock = leagueConfig
    ? buildDraftClock(
        safeCurrentPick,
        leagueConfig.teams,
        leagueConfig.draftInfo.pickNumber,
        leagueConfig.draftInfo.totalPicks,
      )
    : null;

  const availabilityByPlayerId = useMemo<
    Record<string, EspnAvailabilitySignal>
  >(() => {
    if (!leagueClock) return {};
    const takenNames = new Set<string>([
      ...takenPlayers.map((e) => normalizeName(e.player.name)).filter(Boolean),
      ...draftedPlayers.map((p) => normalizeName(p.name)),
    ]);
    return buildEspnAvailabilityMap(players, espnData, leagueClock, takenNames);
  }, [draftedPlayers, espnData, leagueClock, players, takenPlayers]);

  const boardSections = useMemo<BoardSection[]>(() => {
    if (!espnData) {
      return [
        {
          id: "all",
          title: "Top targets",
          subtitle: "Best fits on the live board right now.",
          toneClass: "border-white/12 bg-base",
          players: filteredPlayers.slice(0, 24),
        },
      ];
    }
    const likelyGone = filteredPlayers.filter((e) => {
      const s = availabilityByPlayerId[e.player.id]?.status;
      return s === "now" || s === "swing";
    });
    const bubble = filteredPlayers.filter(
      (e) => availabilityByPlayerId[e.player.id]?.status === "fragile",
    );
    const safer = filteredPlayers.filter((e) => {
      const s = availabilityByPlayerId[e.player.id]?.status;
      return !s || s === "safe" || s === "unknown";
    });
    return [
      {
        id: "likely-gone",
        title: "Likely gone before next turn",
        subtitle: "The room or ESPN queue is pressing on these profiles now.",
        toneClass: "border-danger/20 bg-danger/4",
        players: likelyGone.slice(0, 8),
      },
      {
        id: "bubble",
        title: "Bubble through the swing",
        subtitle:
          "Reasonable chance they make it back, but you are paying risk.",
        toneClass: "border-warn/20 bg-warn/4",
        players: bubble.slice(0, 8),
      },
      {
        id: "safe",
        title: "Safer to wait on",
        subtitle:
          "Targets that project to survive the picks before your next turn.",
        toneClass: "border-accent/15 bg-accent/3",
        players: safer.slice(0, 8),
      },
    ].filter((s) => s.players.length > 0);
  }, [availabilityByPlayerId, espnData, filteredPlayers]);

  const strategySnapshot =
    leagueConfig && profile
      ? buildStrategySnapshot(draftedPlayers, players, leagueConfig)
      : null;

  const needCards = useMemo(
    () =>
      buildNeedCards(
        draftedPlayers,
        profile?.rosterSlots ?? [],
        categoryMeters,
      ),
    [categoryMeters, draftedPlayers, profile],
  );

  const lastAutoRunPlayers = useMemo(
    () =>
      (lastAutoRunBatch?.taken ?? [])
        .map((r) => contextualById[r.playerId]?.player)
        .filter((p): p is Player => Boolean(p)),
    [contextualById, lastAutoRunBatch],
  );

  const canSimRoom = Boolean(
    espnData && leagueClock && !leagueClock.isUserOnClock,
  );

  // ── Prompt copy hook ─────────────────────────────────────────────────────────
  const buildContext = useCallback(() => {
    if (!leagueConfig || !profile || !leagueClock) return null;
    return {
      leagueConfig,
      profile,
      clock: leagueClock,
      draftedPlayers,
      availablePlayers,
      topAvailable: availablePlayers.slice(0, 20),
      recentTaken: takenPlayers
        .slice(0, 8)
        .map((t) => ({ player: t.player, takenAtPick: t.record.takenAtPick })),
      availabilityMap: availabilityByPlayerId,
      draftHistory,
    };
  }, [
    leagueConfig,
    profile,
    leagueClock,
    draftedPlayers,
    availablePlayers,
    takenPlayers,
    availabilityByPlayerId,
    draftHistory,
  ]);

  const {
    promptCopied,
    sysCopied,
    usrCopied,
    copySystemPrompt,
    copyUserPrompt,
    copyFullPrompt,
  } = usePromptCopy(buildContext);

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-dim">
        <span className="font-display text-xs font-bold uppercase tracking-[0.3em]">
          Loading draft command center…
        </span>
      </div>
    );
  }

  if (error || !profile || !leagueConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-6 text-center text-danger-soft">
        <span className="font-display text-xs font-bold uppercase tracking-[0.3em]">
          {error ?? "Draft profile is unavailable."}
        </span>
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const advancePick = () => {
    setCurrentPick((prev) =>
      Math.min(
        (prev ?? leagueConfig.draftInfo.pickNumber) + 1,
        leagueConfig.draftInfo.totalPicks,
      ),
    );
  };

  const handleToggleQueue = (playerId: string) => {
    setQueueIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId],
    );
  };

  const buildAutoRunTakenRecords = (
    simulationStartPick: number,
    selectedPlayerId?: string,
  ): TakenRecord[] => {
    if (!espnData || !leagueConfig) return [];
    const firstSimPick = Math.max(
      1,
      Math.min(simulationStartPick, leagueConfig.draftInfo.totalPicks),
    );
    const simClock = buildDraftClock(
      firstSimPick,
      leagueConfig.teams,
      leagueConfig.draftInfo.pickNumber,
      leagueConfig.draftInfo.totalPicks,
    );
    const picksToSim = simClock.picksUntilUser ?? 0;
    if (picksToSim <= 0) return [];

    const unavailableNames = new Set<string>([
      ...takenPlayers.map((e) => normalizeName(e.player.name)),
      ...draftedPlayers.map((p) => normalizeName(p.name)),
    ]);
    const selectedPlayer = selectedPlayerId
      ? players.find((p) => p.id === selectedPlayerId)
      : null;
    if (selectedPlayer)
      unavailableNames.add(normalizeName(selectedPlayer.name));

    const playersByName = new Map(
      players.map((p) => [normalizeName(p.name), p]),
    );
    const allFirstSpRounds =
      draftHistory?.seasons.flatMap((s) =>
        s.managerPatterns.flatMap((p) =>
          p.firstSpRound != null ? [p.firstSpRound] : [],
        ),
      ) ?? [];
    const avgFirstSpRound =
      allFirstSpRounds.length > 0
        ? Math.round(
            allFirstSpRounds.reduce((a, b) => a + b, 0) /
              allFirstSpRounds.length,
          )
        : 3;
    const batterOnlyPicks =
      leagueConfig.teams * Math.max(1, avgFirstSpRound - 1);
    const priorityPitcherNames = new Set(["paul skenes", "tarik skubal"]);

    const approx = espnData.autoPickApproximation;
    const orderedCandidates = [...approx].sort((a, b) => {
      const effectiveRank = (c: (typeof approx)[number]) => {
        const p = playersByName.get(normalizeName(c.name));
        return p?.type === "pitcher" &&
          !priorityPitcherNames.has(normalizeName(c.name))
          ? c.rank + batterOnlyPicks
          : c.rank;
      };
      return effectiveRank(a) - effectiveRank(b);
    });

    const simulated: TakenRecord[] = [];
    for (const candidate of orderedCandidates) {
      if (simulated.length >= picksToSim) break;
      const candidateName = normalizeName(candidate.name);
      if (unavailableNames.has(candidateName)) continue;
      const matched = playersByName.get(candidateName);
      if (!matched) continue;
      unavailableNames.add(candidateName);
      simulated.push({
        playerId: matched.id,
        takenAtPick: firstSimPick + simulated.length,
      });
    }
    return simulated;
  };

  const runAutoSimulation = (
    simulationStartPick: number,
    triggerPlayerId?: string,
  ) => {
    if (!leagueConfig) return;
    const autoRunTaken = buildAutoRunTakenRecords(
      simulationStartPick,
      triggerPlayerId,
    );
    const removedQueueIds = queueIds.filter((id) =>
      autoRunTaken.some((r) => r.playerId === id),
    );
    if (autoRunTaken.length === 0) {
      setLastAutoRunBatch(null);
      setCurrentPick(
        Math.min(simulationStartPick, leagueConfig.draftInfo.totalPicks),
      );
      return;
    }
    setTaken((prev) => {
      const merged = [...prev];
      autoRunTaken.forEach((r) => {
        if (!merged.some((e) => e.playerId === r.playerId)) merged.push(r);
      });
      return merged;
    });
    setQueueIds((prev) => {
      const blocked = new Set(autoRunTaken.map((r) => r.playerId));
      return prev.filter((id) => !blocked.has(id));
    });
    setLastAutoRunBatch({
      triggerPlayerId: triggerPlayerId ?? "manual-room-sim",
      startPick: simulationStartPick,
      endPick: simulationStartPick + autoRunTaken.length - 1,
      taken: autoRunTaken,
      removedQueueIds,
    });
    setCurrentPick(
      Math.min(
        simulationStartPick + autoRunTaken.length,
        leagueConfig.draftInfo.totalPicks,
      ),
    );
  };

  const handleDraft = (playerId: string) => {
    if (draftedSet.has(playerId)) {
      setDrafted((prev) => prev.filter((r) => r.playerId !== playerId));
      if (lastAutoRunBatch?.triggerPlayerId === playerId)
        setLastAutoRunBatch(null);
      return;
    }
    const nextPick = Math.min(
      safeCurrentPick + 1,
      leagueConfig.draftInfo.totalPicks,
    );
    setTaken((prev) => prev.filter((r) => r.playerId !== playerId));
    setDrafted((prev) => [...prev, { playerId, slotId: null }]);
    if (espnData && !liveSyncEnabled) {
      runAutoSimulation(nextPick, playerId);
      return;
    }
    setCurrentPick(nextPick);
    setLastAutoRunBatch(null);
  };

  const handleMarkTaken = (playerId: string) => {
    if (takenSet.has(playerId)) return;
    setDrafted((prev) => prev.filter((r) => r.playerId !== playerId));
    setTaken((prev) => [
      ...prev.filter((r) => r.playerId !== playerId),
      { playerId, takenAtPick: safeCurrentPick },
    ]);
    setQueueIds((prev) => prev.filter((id) => id !== playerId));
    setLastAutoRunBatch(null);
    advancePick();
  };

  const handleRestoreTaken = (playerId: string) => {
    setTaken((prev) => prev.filter((r) => r.playerId !== playerId));
  };

  const handleUndoLastAutoRun = () => {
    if (!lastAutoRunBatch) return;
    const autoTakenIds = new Set(lastAutoRunBatch.taken.map((r) => r.playerId));
    setTaken((prev) => prev.filter((r) => !autoTakenIds.has(r.playerId)));
    setQueueIds((prev) => {
      const restored = [...prev];
      lastAutoRunBatch.removedQueueIds.forEach((id) => {
        if (!restored.includes(id) && !draftedSet.has(id)) restored.push(id);
      });
      return restored;
    });
    setCurrentPick((prev) =>
      Math.max(
        leagueConfig.draftInfo.pickNumber,
        (prev ?? leagueConfig.draftInfo.pickNumber) -
          lastAutoRunBatch.taken.length,
      ),
    );
    setLastAutoRunBatch(null);
  };

  const handleResetAll = () => {
    if (
      !window.confirm(
        "Reset everything? This clears your roster, taken list, queue, and notes.",
      )
    )
      return;
    setDrafted([]);
    setTaken([]);
    setQueueIds([]);
    setStrategyNotes("");
    setLastAutoRunBatch(null);
    setCurrentPick(leagueConfig.draftInfo.pickNumber);
  };

  const handleImportPicks = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text) as {
        picks: Array<{
          name: string;
          pickStr: string;
          overallPick: number;
          isMyPick: boolean;
        }>;
        numTeams?: number;
        extractedAt?: number;
      };
      if (!Array.isArray(data.picks)) throw new Error("Invalid format");
      const stripSuffix = (n: string) =>
        normalizeName(n)
          .replace(/\s+(jr\.?|sr\.?|i{1,3}v?|iv|vi*)\.?\s*$/i, "")
          .trim();
      const byNorm = new Map<string, Player>();
      for (const p of players) {
        byNorm.set(normalizeName(p.name), p);
        byNorm.set(stripSuffix(p.name), p);
      }
      let takenCount = 0,
        draftedCount = 0;
      const unmatched: string[] = [];
      const newTaken: TakenRecord[] = [...taken];
      const newDrafted: DraftedRecord[] = [...drafted];
      for (const pick of data.picks) {
        const player =
          byNorm.get(normalizeName(pick.name)) ??
          byNorm.get(stripSuffix(pick.name));
        if (!player) {
          unmatched.push(pick.name);
          continue;
        }
        if (pick.isMyPick) {
          if (!newDrafted.some((r) => r.playerId === player.id)) {
            newDrafted.push({ playerId: player.id, slotId: null });
            draftedCount++;
          }
        } else {
          if (!newTaken.some((r) => r.playerId === player.id)) {
            newTaken.push({
              playerId: player.id,
              takenAtPick: pick.overallPick,
            });
            takenCount++;
          }
        }
      }
      setTaken(newTaken);
      setDrafted(newDrafted);
      const maxPick = data.picks.reduce(
        (max, p) => (p.overallPick > max ? p.overallPick : max),
        0,
      );
      if (maxPick > 0)
        setCurrentPick((prev) => {
          const next = maxPick + 1;
          return prev == null || next > prev ? next : prev;
        });
      const parts = [`Imported: ${takenCount} auto, ${draftedCount} yours`];
      if (unmatched.length > 0)
        parts.push(`Unmatched: ${unmatched.join(", ")}`);
      setImportStatus(parts.join(" · "));
      setTimeout(() => setImportStatus(null), 8000);
    } catch {
      setImportStatus(
        "Import failed — run the bookmarklet on Draft Board first",
      );
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const handleSyncAndCopy = async () => {
    if (!leagueConfig || !profile) return;
    setSyncCopyStatus("syncing");
    try {
      const { teams, draftInfo } = leagueConfig;
      const userPickNumbers = new Set<number>();
      for (
        let round = 1;
        round <= Math.ceil(draftInfo.totalPicks / teams);
        round++
      ) {
        const slot =
          round % 2 === 1
            ? draftInfo.pickNumber
            : teams - draftInfo.pickNumber + 1;
        const overall = (round - 1) * teams + slot;
        if (overall <= draftInfo.totalPicks) userPickNumbers.add(overall);
      }
      const newDrafted: DraftedRecord[] = [...drafted];
      const newTaken: TakenRecord[] = [...taken];
      let maxPick = 0,
        fresh = espnData;

      try {
        const fetched = await loadEspnLeagueDataFresh();
        const realPicks = fetched.draftPicks.filter((p) => p.playerId > 0);
        if (realPicks.length > 0) {
          fresh = fetched;
          setEspnData(fetched);
          const playerByMlbId = new Map(
            players.filter((p) => p.mlbId != null).map((p) => [p.mlbId!, p]),
          );
          for (const pick of realPicks) {
            const player = playerByMlbId.get(pick.playerId);
            if (!player) continue;
            maxPick = Math.max(maxPick, pick.overallPickNumber);
            if (userPickNumbers.has(pick.overallPickNumber)) {
              if (!newDrafted.some((r) => r.playerId === player.id))
                newDrafted.push({ playerId: player.id, slotId: null });
            } else {
              if (!newTaken.some((r) => r.playerId === player.id))
                newTaken.push({
                  playerId: player.id,
                  takenAtPick: pick.overallPickNumber,
                });
            }
          }
        }
      } catch {
        /* live-poll.js not running — fall through */
      }

      if (maxPick === 0) {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text) as {
          picks: Array<{
            name: string;
            pickStr: string;
            overallPick: number;
            isMyPick: boolean;
          }>;
        };
        if (!Array.isArray(data.picks))
          throw new Error(
            "No ESPN picks available and clipboard is not bookmarklet data",
          );
        const stripSuffix = (n: string) =>
          normalizeName(n)
            .replace(/\s+(jr\.?|sr\.?|i{1,3}v?|iv|vi*)\.?\s*$/i, "")
            .trim();
        const byNorm = new Map<string, Player>();
        for (const p of players) {
          byNorm.set(normalizeName(p.name), p);
          byNorm.set(stripSuffix(p.name), p);
        }
        for (const pick of data.picks) {
          const player =
            byNorm.get(normalizeName(pick.name)) ??
            byNorm.get(stripSuffix(pick.name));
          if (!player) continue;
          maxPick = Math.max(maxPick, pick.overallPick);
          if (pick.isMyPick) {
            if (!newDrafted.some((r) => r.playerId === player.id))
              newDrafted.push({ playerId: player.id, slotId: null });
          } else {
            if (!newTaken.some((r) => r.playerId === player.id))
              newTaken.push({
                playerId: player.id,
                takenAtPick: pick.overallPick,
              });
          }
        }
      }

      setDrafted(newDrafted);
      setTaken(newTaken);
      const nextPick = maxPick > 0 ? maxPick + 1 : safeCurrentPick;
      if (maxPick > 0)
        setCurrentPick((prev) =>
          prev == null || nextPick > prev ? nextPick : prev,
        );

      const newDraftedPlayers = newDrafted
        .map((r) => evaluatedById[r.playerId]?.player)
        .filter((p): p is Player => Boolean(p));
      const newDraftedSet = new Set(newDrafted.map((r) => r.playerId));
      const newTakenSet = new Set(newTaken.map((r) => r.playerId));
      const freshEspnTakenSet = new Set(
        (fresh?.draftPicks ?? [])
          .filter((p) => p.playerId > 0)
          .map((p) => p.playerId),
      );
      const freshAvailable = contextualPlayers.filter(
        (e) =>
          !newDraftedSet.has(e.player.id) &&
          !newTakenSet.has(e.player.id) &&
          !(e.player.mlbId && freshEspnTakenSet.has(e.player.mlbId)),
      );
      const clock = buildDraftClock(
        nextPick,
        teams,
        draftInfo.pickNumber,
        draftInfo.totalPicks,
      );
      const takenNames = new Set<string>([
        ...newTaken
          .map((r) => evaluatedById[r.playerId]?.player)
          .filter(Boolean)
          .map((p) => normalizeName(p!.name)),
        ...newDraftedPlayers.map((p) => normalizeName(p.name)),
      ]);
      const freshAvailabilityMap = buildEspnAvailabilityMap(
        players,
        fresh,
        clock,
        takenNames,
      );
      const recentTaken = [...newTaken]
        .sort((a, b) => b.takenAtPick - a.takenAtPick)
        .slice(0, 8)
        .map((r) => ({
          player: evaluatedById[r.playerId]?.player!,
          takenAtPick: r.takenAtPick,
        }))
        .filter((x) => x.player);

      const { user } = buildAdvicePrompt({
        leagueConfig,
        profile,
        clock,
        draftedPlayers: newDraftedPlayers,
        availablePlayers: freshAvailable,
        topAvailable: freshAvailable.slice(0, 20),
        recentTaken,
        availabilityMap: freshAvailabilityMap,
        draftHistory,
      });
      await navigator.clipboard.writeText(user);
      setSyncCopyStatus("copied");
      setTimeout(() => setSyncCopyStatus("idle"), 3000);
    } catch {
      setSyncCopyStatus("error");
      setTimeout(() => setSyncCopyStatus("idle"), 3000);
    }
  };

  const updateSlotAssignment = (playerId: string, slotId: string) => {
    setDrafted((prev) =>
      prev.map((r) =>
        r.playerId === playerId
          ? { ...r, slotId: slotId || null }
          : r.slotId === slotId
            ? { ...r, slotId: null }
            : r,
      ),
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base text-body">
      <div className="mx-auto max-w-410 px-0 pb-12 md:px-0 xl:px-0">
        <header
          className="flex items-center justify-between gap-4 px-4 py-2.5 md:px-5"
          style={{
            background: "var(--color-surface)",
            borderBottom: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="font-display font-black uppercase text-white shrink-0"
                style={{ fontSize: "17px", letterSpacing: "0.04em" }}
              >
                {profile.leagueName}
              </span>
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-dim hidden sm:block">
                Slot {leagueConfig.draftInfo.pickNumber}
              </span>
            </div>
            <div
              className="h-4 w-px shrink-0"
              style={{ background: "rgba(255,255,255,0.1)" }}
            />
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="font-data font-medium text-accent"
                style={{ fontSize: "22px" }}
              >
                {leagueClock?.currentPick ?? safeCurrentPick}
              </span>
              <div className="font-display text-[9px] font-bold uppercase leading-tight text-muted">
                <div>R{leagueClock?.currentRound ?? "—"}</div>
                <div>P{leagueClock?.roundPick ?? "—"}</div>
              </div>
              {leagueClock?.isUserOnClock ? (
                <span
                  className="font-display px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-base"
                  style={{ background: "var(--color-accent)" }}
                >
                  ON CLOCK
                </span>
              ) : leagueClock?.picksUntilUser ? (
                <span className="font-display text-[9px] font-bold uppercase tracking-[0.15em] text-dim">
                  +{leagueClock.picksUntilUser}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                setCurrentPick((p) => Math.max(1, (p ?? safeCurrentPick) - 1))
              }
              className="font-display border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-dim transition-colors hover:text-soft"
            >
              −1
            </button>
            <button
              onClick={advancePick}
              className="font-display border border-accent/35 bg-accent/8 px-2.5 py-1.5 text-[10px] font-bold text-accent transition-colors hover:bg-accent/15"
            >
              +1
            </button>
            <button
              onClick={() => runAutoSimulation(safeCurrentPick)}
              disabled={!canSimRoom || liveSyncEnabled}
              className={`font-display px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${canSimRoom && !liveSyncEnabled ? "border border-accent/40 bg-accent text-base hover:bg-accent/90" : "border border-white/12 text-dim"}`}
            >
              Sim
            </button>
            {espnData && (
              <button
                onClick={() => setLiveSyncEnabled((v) => !v)}
                title={
                  liveSyncLastAt
                    ? `Last sync: ${liveSyncLastAt.toLocaleTimeString()}`
                    : "Poll ESPN every 15s"
                }
                className={`font-display px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  liveSyncEnabled
                    ? liveSyncStatus === "error"
                      ? "border border-danger/40 bg-danger/10 text-danger-soft"
                      : "border border-accent/40 bg-accent/15 text-accent"
                    : "border border-white/12 text-dim hover:text-soft"
                }`}
              >
                {liveSyncEnabled
                  ? liveSyncStatus === "syncing"
                    ? "⟳ Live"
                    : "● Live"
                  : "Live"}
              </button>
            )}
            <div
              className="mx-1 h-4 w-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <button
              onClick={handleImportPicks}
              title="Import picks from DraftWizard bookmarklet"
              className="font-display border border-blue/20 px-2.5 py-1.5 text-[10px] font-bold text-blue-soft/70 transition-colors hover:text-blue-soft"
            >
              Import
            </button>
            <button
              onClick={handleSyncAndCopy}
              disabled={syncCopyStatus === "syncing" || !espnData}
              title="Sync ESPN picks + copy prompt (requires live-poll.js)"
              className={`font-display px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                !espnData || syncCopyStatus === "syncing"
                  ? "border border-white/12 text-dim"
                  : syncCopyStatus === "copied"
                    ? "border border-accent/40 bg-accent/15 text-accent"
                    : syncCopyStatus === "error"
                      ? "border border-danger/40 text-danger-soft"
                      : "border border-blue/35 bg-blue/10 text-blue-soft hover:bg-blue/20"
              }`}
            >
              {syncCopyStatus === "syncing"
                ? "⟳"
                : syncCopyStatus === "copied"
                  ? "✓ Copied"
                  : syncCopyStatus === "error"
                    ? "!"
                    : "Sync + Copy"}
            </button>
            <button
              onClick={() => setCurrentPick(leagueConfig.draftInfo.pickNumber)}
              className="font-display border border-white/14 px-2.5 py-1.5 text-[10px] font-bold text-dim transition-colors hover:text-soft"
            >
              Reset
            </button>
            <button
              onClick={handleResetAll}
              className="font-display border border-danger/18 px-2.5 py-1.5 text-[10px] font-bold text-danger/60 transition-colors hover:text-danger-soft"
            >
              Wipe
            </button>
            <button
              onClick={copySystemPrompt}
              title="Copy system prompt"
              className="font-display border border-white/12 px-2.5 py-1.5 text-[10px] font-bold text-dim transition-colors hover:text-muted"
            >
              {sysCopied ? "✓" : "sys"}
            </button>
            <button
              onClick={copyUserPrompt}
              title="Copy user prompt"
              className="font-display border border-white/12 px-2.5 py-1.5 text-[10px] font-bold text-dim transition-colors hover:text-muted"
            >
              {usrCopied ? "✓" : "usr"}
            </button>
            <button
              onClick={copyFullPrompt}
              title="Copy full prompt (system + user)"
              className="font-display border border-white/12 px-2.5 py-1.5 text-[10px] font-bold text-dim transition-colors hover:text-muted"
            >
              {promptCopied ? "✓" : "⋯"}
            </button>
          </div>
        </header>

        {importStatus && (
          <div className="px-6 py-2 text-[10px] font-display font-bold text-blue-soft border-b border-blue/15 bg-blue/5">
            {importStatus}
          </div>
        )}

        <div
          className="mt-5 flex"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.14)" }}
        >
          {(["board", "intel"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="font-display relative px-6 py-4 text-[10px] font-bold uppercase tracking-[0.3em] transition-colors"
              style={
                activeTab === tab
                  ? {
                      color: "var(--color-accent)",
                      borderBottom: "2px solid var(--color-accent)",
                      marginBottom: "-1px",
                      background: "rgba(180,240,0,0.03)",
                    }
                  : {
                      color: "var(--color-ghost)",
                      borderBottom: "2px solid transparent",
                      marginBottom: "-1px",
                    }
              }
            >
              {tab === "board" ? "Board" : "Intel"}
            </button>
          ))}
        </div>

        {activeTab === "board" && (
          <div className="grid xl:grid-cols-[310px_minmax(0,1fr)]">
            <BoardSidebar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              focusArea={focusArea}
              onFocusChange={setFocusArea}
              queueOnly={queueOnly}
              onQueueOnlyChange={setQueueOnly}
              queuePlayers={queuePlayers}
              availabilityByPlayerId={availabilityByPlayerId}
              onToggleQueue={handleToggleQueue}
              drafted={drafted}
              profile={profile}
              contextualById={contextualById}
              onDraft={handleDraft}
              onUpdateSlotAssignment={updateSlotAssignment}
            />
            <BoardMain
              boardSections={boardSections}
              availabilityByPlayerId={availabilityByPlayerId}
              queueIds={queueIds}
              draftedSet={draftedSet}
              filteredCount={filteredPlayers.length}
              takenCount={takenPlayers.length}
              espnData={espnData}
              onToggleQueue={handleToggleQueue}
              onDraft={handleDraft}
              onMarkTaken={handleMarkTaken}
            />
          </div>
        )}

        {activeTab === "intel" && (
          <IntelPanel
            strategySnapshot={strategySnapshot}
            needCards={needCards}
            leagueConfig={leagueConfig}
            lastAutoRunBatch={lastAutoRunBatch}
            lastAutoRunPlayers={lastAutoRunPlayers}
            boardSections={boardSections}
            takenPlayers={takenPlayers}
            filteredPlayers={filteredPlayers}
            espnData={espnData}
            strategyNotes={strategyNotes}
            profile={profile}
            onUndoLastAutoRun={handleUndoLastAutoRun}
            onRestoreTaken={handleRestoreTaken}
            onStrategyNotesChange={setStrategyNotes}
          />
        )}
      </div>
    </div>
  );
}
