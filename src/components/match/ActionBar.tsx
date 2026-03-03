import { useEffect, useState } from "react";
import { Button } from "@/components/ui/8bit/button";
import { Sparkles } from "lucide-react";
import { canActivateAbility } from "@/engine/abilitySystem";
import { buildForecastSnapshot } from "@/engine/forecastPanel";
import { BATTER_APPROACHES, PITCH_STRATEGIES } from "@/engine/approachConfig";
import type { InteractiveMatchState } from "@/engine/interactiveMatchEngine";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { Ability } from "@/types/ability";
import { ForecastPanel } from "@/components/ForecastPanel";
import { SIM_MODE_LABELS, type SimMode } from "./constants";
import { ZoneGrid } from "./ZoneGrid";
import {
  getExecutionNote,
  type ZoneMap,
  type ZoneCell,
} from "@/engine/zoneSystem";

const ABILITY_SHORTCUT_KEYS = ["z", "x", "c"];

// Display metadata for each at-bat outcome
const OUTCOME_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  homerun:      { icon: "🏠", label: "Home Run!",  color: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-500/10 border border-yellow-500/30" },
  triple:       { icon: "🔺", label: "Triple!",    color: "text-green-500 dark:text-green-400",   bg: "bg-green-500/10 border border-green-500/30"  },
  double:       { icon: "⬆️",  label: "Double!",   color: "text-blue-500 dark:text-blue-400",     bg: "bg-blue-500/10 border border-blue-500/30"    },
  single:       { icon: "➡️",  label: "Single",    color: "text-blue-400 dark:text-blue-300",     bg: "bg-blue-500/8 border border-blue-500/20"     },
  walk:         { icon: "🟡",  label: "Walk",      color: "text-orange-400",                       bg: "bg-orange-500/10 border border-orange-500/30" },
  strikeout:    { icon: "🔴",  label: "Strikeout", color: "text-red-500",                          bg: "bg-red-500/10 border border-red-500/30"      },
  bunt_attempt: { icon: "📍",  label: "Bunt",      color: "text-muted-foreground",                 bg: "bg-muted/60 border border-border"            },
  out:          { icon: "⚫",  label: "Out",        color: "text-muted-foreground",                 bg: "bg-muted/60 border border-border"            },
};

// Batting approach order + keyboard shortcuts (q/w/e)
const APPROACH_ORDER: BatterApproach[] = ["power", "contact", "patient"];
const APPROACH_SHORTCUTS = ["q", "w", "e"];

// Pitching strategy order + keyboard shortcuts (q/w/e)
const STRATEGY_ORDER: PitchStrategy[] = ["challenge", "finesse", "paint"];
const STRATEGY_SHORTCUTS = ["q", "w", "e"];

function isGuaranteedAbility(ability: Ability | null): boolean {
  return ability?.effects.some((e) => e.type === "guaranteed_outcome") ?? false;
}

interface ActionBarProps {
  matchState: InteractiveMatchState;
  isMyBatter: boolean;
  autoSimulating: boolean;
  simMode: SimMode | null;
  showingResult: boolean;
  selectedAbility: string | null;
  setSelectedAbility: (id: string | null) => void;
  currentBatterAbilities: Ability[];
  currentPitcherAbilities: Ability[];
  selectedAbilityDef: Ability | null;
  onSimulateAtBat: (approach?: BatterApproach, strategy?: PitchStrategy, aimedZone?: ZoneCell) => void;
  onContinue: () => void;
  zoneMap: ZoneMap;
  pitchHint?: ZoneCell[];
  inningGamePlan?: BatterApproach | null;
}

export function ActionBar({
  matchState,
  isMyBatter,
  autoSimulating,
  simMode,
  showingResult,
  selectedAbility,
  setSelectedAbility,
  currentBatterAbilities,
  currentPitcherAbilities,
  selectedAbilityDef,
  onSimulateAtBat,
  onContinue,
  zoneMap,
  pitchHint,
  inningGamePlan,
}: ActionBarProps) {
  // Explicit approach selection — decoupled from zone row.
  // Defaults to the active game plan, then last used, then "contact".
  const [selectedApproach, setSelectedApproach] = useState<BatterApproach>(
    inningGamePlan ?? matchState.lastBatterApproach ?? "contact"
  );
  const [selectedStrategy, setSelectedStrategy] = useState<PitchStrategy>(
    matchState.lastPitchStrategy ?? "finesse"
  );

  // Re-sync when the batter/pitcher changes (new at-bat)
  useEffect(() => {
    setSelectedApproach(inningGamePlan ?? matchState.lastBatterApproach ?? "contact");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState.currentBatter.id]);

  useEffect(() => {
    setSelectedStrategy(matchState.lastPitchStrategy ?? "finesse");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState.currentPitcher.id]);

  // q/w/e shortcuts for approach (batting) or strategy (pitching)
  useEffect(() => {
    if (autoSimulating || showingResult || matchState.inningComplete || matchState.isComplete) return;
    function onKey(e: KeyboardEvent) {
      const idx = APPROACH_SHORTCUTS.indexOf(e.key);
      if (idx === -1) return;
      if (isMyBatter) {
        setSelectedApproach(APPROACH_ORDER[idx]);
      } else {
        setSelectedStrategy(STRATEGY_ORDER[idx]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoSimulating, showingResult, matchState.inningComplete, matchState.isComplete, isMyBatter]);

  // Forecast uses the live selection, not the stale "last used" value
  const leverageContext = {
    inning: matchState.inning,
    myRuns: matchState.myRuns,
    opponentRuns: matchState.opponentRuns,
    bases: matchState.bases,
  };

  const forecastSnapshot = (() => {
    if (isMyBatter) {
      return buildForecastSnapshot({
        mode: "batting",
        approach: selectedApproach,
        lastApproach: matchState.lastBatterApproach,
        consecutiveApproach: selectedApproach === matchState.lastBatterApproach
          ? matchState.consecutiveBatterApproach
          : 0,
      }, leverageContext);
    }
    return buildForecastSnapshot({
      mode: "pitching",
      strategy: selectedStrategy,
      lastStrategy: matchState.lastPitchStrategy,
      consecutiveStrategy: selectedStrategy === matchState.lastPitchStrategy
        ? matchState.consecutivePitchStrategy
        : 0,
    }, leverageContext);
  })();

  if (autoSimulating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <div className="text-sm font-medium animate-pulse">
          {simMode ? SIM_MODE_LABELS[simMode] : "Simulating"}...
        </div>
      </div>
    );
  }

  if (showingResult) {
    const lastPlay = matchState.playByPlay[matchState.playByPlay.length - 1];
    const meta = lastPlay
      ? (OUTCOME_META[lastPlay.outcome] ?? OUTCOME_META.out)
      : OUTCOME_META.out;
    const isHit = lastPlay && ["homerun", "triple", "double", "single"].includes(lastPlay.outcome);
    const isMoment = lastPlay?.perfectContact || lastPlay?.paintedCorner;
    const scoreLine = `${matchState.myRuns} – ${matchState.opponentRuns}`;
    const halfLabel = matchState.isTop ? "Top" : "Bot";
    const continueLabel = matchState.isComplete
      ? "See Final Score"
      : matchState.inningComplete
        ? "Next Inning"
        : "Next Batter";

    return (
      <div className="h-full flex flex-col gap-2.5 py-1">
        {/* Outcome headline */}
        <div className={`text-center py-3 px-3 rounded-lg ${meta.bg}`}>
          <div className="text-2xl mb-1 leading-none">{meta.icon}</div>
          <div className={`text-sm font-bold uppercase tracking-wide ${meta.color}`}>
            {meta.label}
            {isMoment && <span className="ml-1.5 text-amber-400">✨</span>}
          </div>
          {isHit && lastPlay?.rbi != null && lastPlay.rbi > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {lastPlay.rbi} RBI
            </div>
          )}
        </div>

        {/* Narrative text */}
        {lastPlay?.narrativeText && (
          <p className="text-xs text-muted-foreground italic text-center px-1 leading-snug line-clamp-3">
            "{lastPlay.narrativeText}"
          </p>
        )}

        {/* Score + situation */}
        <div className="flex items-center justify-between px-1 mt-auto">
          <span className="font-mono font-bold text-base tabular-nums">
            {scoreLine}
          </span>
          <span className="text-xs text-muted-foreground">
            {matchState.outs} out{matchState.outs !== 1 ? "s" : ""}
            {" · "}
            {halfLabel} {matchState.inning}
          </span>
        </div>

        {/* Continue button */}
        <Button size="lg" onClick={onContinue} className="w-full py-5 text-sm">
          {continueLabel}
          {" ›"}
          <kbd className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
            Space
          </kbd>
        </Button>
      </div>
    );
  }

  if (matchState.inningComplete) {
    const lastPlay = matchState.playByPlay[matchState.playByPlay.length - 1];
    const halfInningPlays = lastPlay
      ? matchState.playByPlay.filter(
          (p) => p.inning === lastPlay.inning && p.isTop === lastPlay.isTop,
        )
      : [];

    const runsThisHalf = halfInningPlays.reduce((sum, p) => sum + (p.rbi ?? 0), 0);

    // My team just batted when isTop=false (isMyBatter=true)
    const myTeamBatted = !matchState.isTop;

    // Detect lead change: reconstruct score before this half-inning
    const myRunsBefore    = myTeamBatted ? matchState.myRuns - runsThisHalf : matchState.myRuns;
    const theirRunsBefore = myTeamBatted ? matchState.opponentRuns : matchState.opponentRuns - runsThisHalf;
    const wasTied    = myRunsBefore === theirRunsBefore;
    const weWereAhead   = myRunsBefore > theirRunsBefore;
    const theyWereAhead = theirRunsBefore > myRunsBefore;
    const nowTied    = matchState.myRuns === matchState.opponentRuns;
    const weLeadNow  = matchState.myRuns > matchState.opponentRuns;

    const leadChanged =
      (myTeamBatted  && (theyWereAhead || (wasTied && runsThisHalf > 0)) && weLeadNow) ||
      (!myTeamBatted && (weWereAhead   || (wasTied && runsThisHalf > 0)) && !weLeadNow && !nowTied);
    const leadTied =
      !wasTied && nowTied && runsThisHalf > 0;

    // Inning labels
    const halfLabel    = matchState.isTop ? "Top" : "Bottom";
    const halfEndLabel = matchState.isTop ? "Middle" : "End";
    const pitcher      = matchState.isTop ? matchState.myPitcher : matchState.opponentPitcher;
    const pitcherIP    = matchState.isTop ? matchState.myPitcherInnings : matchState.opponentPitcherInnings;
    const nextHalfLabel = matchState.isTop ? "Bottom" : `Top ${matchState.inning + 1}`;
    const scoreLine = `${matchState.myRuns} – ${matchState.opponentRuns}`;

    // Per-play display config
    const PLAY_ICONS: Record<string, string> = {
      homerun: "🏠", triple: "🔺", double: "⬆️",
      single: "➡️", walk: "🟡", strikeout: "🔴",
      groundout: "⚫", flyout: "⚫", lineout: "⚫", popout: "⚫",
    };
    const isHit    = (o: string) => ["homerun","triple","double","single"].includes(o);
    const isScoring = (rbi?: number) => (rbi ?? 0) > 0;
    const isOut     = (o: string) => ["groundout","flyout","lineout","popout","strikeout"].includes(o);

    // Header color: amber if my team scored, red if opponent scored, grey if scoreless
    const headerClass = runsThisHalf > 0
      ? myTeamBatted
        ? "bg-amber-500/15 border-amber-500/40"
        : "bg-red-500/15 border-red-500/40"
      : "bg-muted/40 border-border";
    const headerTextClass = runsThisHalf > 0
      ? myTeamBatted ? "text-amber-400" : "text-red-400"
      : "text-muted-foreground";

    return (
      <div className="h-full flex flex-col gap-2 py-1">

        {/* ── Header ── */}
        <div className={`shrink-0 rounded-lg border px-3 py-2.5 ${headerClass}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {halfEndLabel} · {halfLabel} {matchState.inning}
            </span>
            {/* Lead change / tied badge */}
            {leadChanged && (
              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${myTeamBatted ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40"}`}>
                {myTeamBatted ? "↑ LEAD TAKEN" : "↓ LEAD LOST"}
              </span>
            )}
            {leadTied && !leadChanged && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                TIED
              </span>
            )}
          </div>

          <div className="flex items-end gap-2">
            <span className="font-mono font-bold text-xl tabular-nums">{scoreLine}</span>
            {runsThisHalf > 0 ? (
              <span className={`text-sm font-bold mb-0.5 ${headerTextClass}`}>
                +{runsThisHalf} {runsThisHalf === 1 ? "run" : "runs"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground mb-0.5">3 up, 3 down</span>
            )}
          </div>
        </div>

        {/* ── Batter-by-batter recap ── */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
          {halfInningPlays.map((play, i) => {
            const icon    = PLAY_ICONS[play.outcome] ?? "⚪";
            const scoring = isScoring(play.rbi);
            const hit     = isHit(play.outcome);
            const out     = isOut(play.outcome);

            if (scoring) {
              // Full-size scoring row
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                    myTeamBatted
                      ? "bg-amber-500/10 border border-amber-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <span className="text-base leading-none shrink-0">{icon}</span>
                  <span className={`text-sm font-semibold flex-1 truncate ${myTeamBatted ? "text-amber-300" : "text-red-300"}`}>
                    {play.batter}
                  </span>
                  <span className={`text-xs font-bold shrink-0 ${myTeamBatted ? "text-amber-400" : "text-red-400"}`}>
                    +{play.rbi} {(play.rbi ?? 0) === 1 ? "run" : "runs"}
                  </span>
                </div>
              );
            }

            if (hit) {
              // Non-scoring hit — visible but not highlighted
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded">
                  <span className="text-sm leading-none shrink-0 opacity-70">{icon}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{play.batter}</span>
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide shrink-0">
                    {play.outcome}
                  </span>
                </div>
              );
            }

            if (out) {
              // Outs — tiny, dimmed
              return (
                <div key={i} className="flex items-center gap-1.5 px-2 py-0.5">
                  <span className="text-[10px] leading-none shrink-0 opacity-30">{icon}</span>
                  <span className="text-[10px] text-muted-foreground/30 flex-1 truncate">
                    {play.batter}
                  </span>
                  <span className="text-[9px] text-muted-foreground/20 uppercase tracking-wide shrink-0">
                    {play.outcome === "strikeout" ? "K" : "out"}
                  </span>
                </div>
              );
            }

            // Walk, HBP, or any other non-scoring non-hit
            return (
              <div key={i} className="flex items-center gap-2 px-2 py-1">
                <span className="text-sm leading-none shrink-0 opacity-50">{icon}</span>
                <span className="text-xs text-muted-foreground/60 flex-1 truncate">{play.batter}</span>
                <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wide shrink-0">
                  {play.outcome}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Pitcher line ── */}
        <div className="shrink-0 flex items-center justify-between px-1 pt-1 border-t border-border/40">
          <span className="text-xs text-muted-foreground truncate">
            {pitcher.name}
            <span className="ml-1 text-muted-foreground/60">{pitcherIP} IP</span>
          </span>
          {runsThisHalf > 0 && (
            <span className="text-xs text-muted-foreground/60 shrink-0 ml-2">
              {runsThisHalf} ER
            </span>
          )}
        </div>

        {/* ── Continue ── */}
        <Button
          size="lg"
          onClick={onContinue}
          className="shrink-0 w-full py-5 text-sm"
        >
          {matchState.isComplete ? "See Final Score" : `Start ${nextHalfLabel} ›`}
          <kbd className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
            Space
          </kbd>
        </Button>
      </div>
    );
  }

  if (isMyBatter) {
    return (
      /* === MY TEAM BATTING === */
      <div className="space-y-1.5">
        <ForecastPanel snapshot={forecastSnapshot} modeLabel="Batting" />

        {/* Approach selector + inline ability chips */}
        <div className="flex items-center gap-2 min-h-7">
          <div className="flex gap-1 flex-1">
            {APPROACH_ORDER.map((id, i) => {
              const cfg = BATTER_APPROACHES[id];
              const isSelected = selectedApproach === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedApproach(id)}
                  title={cfg.description}
                  className={`flex-1 py-1 px-1.5 rounded border text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/15 text-foreground ring-1 ring-blue-500/30"
                      : "border-border bg-card hover:bg-accent text-muted-foreground"
                  }`}
                >
                  <span className="text-sm leading-none">{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <kbd className="text-[9px] font-mono opacity-40 bg-black/10 dark:bg-white/10 rounded px-1 py-px">
                    {APPROACH_SHORTCUTS[i].toUpperCase()}
                  </kbd>
                </button>
              );
            })}
          </div>

          {/* Ability chips */}
          {currentBatterAbilities.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto shrink-0">
              {currentBatterAbilities.map((ability, i) => {
                const { canActivate, reason } = canActivateAbility(
                  matchState.currentBatter,
                  ability.id,
                );
                const isSelected = selectedAbility === ability.id;
                const shortcut = ABILITY_SHORTCUT_KEYS[i];
                return (
                  <button
                    key={ability.id}
                    onClick={() => setSelectedAbility(isSelected ? null : ability.id)}
                    disabled={!canActivate}
                    title={
                      !canActivate && reason
                        ? reason
                        : `${ability.description}${shortcut ? ` [${shortcut.toUpperCase()}]` : ""}`
                    }
                    className={`flex items-center gap-1 border rounded px-2 py-0.5 text-xs transition whitespace-nowrap ${
                      isSelected
                        ? "border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-500/20 ring-1 ring-blue-500/30 text-foreground"
                        : canActivate
                          ? "border-border bg-card hover:bg-accent text-foreground"
                          : "opacity-40 cursor-not-allowed border-border bg-card"
                    }`}
                  >
                    <span>{ability.iconEmoji}</span>
                    <span className="font-medium">{ability.name}</span>
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      {ability.spiritCost}
                    </span>
                    {shortcut && (
                      <kbd className="text-[9px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1 py-px">
                        {shortcut.toUpperCase()}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Zone grid — purely location prediction, no row-approach coupling */}
        {isGuaranteedAbility(selectedAbilityDef) ? (
          <Button
            size="lg"
            onClick={() => onSimulateAtBat()}
            className="w-full h-auto py-3 flex items-center justify-center gap-2"
          >
            <span className="text-xl leading-none">{selectedAbilityDef!.iconEmoji}</span>
            <span className="font-bold text-sm">{selectedAbilityDef!.name}</span>
          </Button>
        ) : (
          <ZoneGrid
            mode="batting"
            zoneMap={zoneMap}
            pitchHint={pitchHint}
            onSelect={(cell) => {
              onSimulateAtBat(selectedApproach, undefined, cell);
            }}
          />
        )}

        {/* Selected ability description */}
        {selectedAbilityDef && (
          <div className="text-xs px-1 text-muted-foreground leading-snug">
            {selectedAbilityDef.iconEmoji}{" "}
            <span className="font-medium">{selectedAbilityDef.name}</span> —{" "}
            {selectedAbilityDef.description}
          </div>
        )}
      </div>
    );
  }

  return (
    /* === OPPONENT BATTING (my pitcher) === */
    <div className="space-y-1.5">
      <ForecastPanel snapshot={forecastSnapshot} modeLabel="Pitching" />

      {/* Strategy selector + inline ability chips */}
      <div className="flex items-center gap-2 min-h-7">
        <div className="flex gap-1 flex-1">
          {STRATEGY_ORDER.map((id, i) => {
            const cfg = PITCH_STRATEGIES[id];
            const isSelected = selectedStrategy === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedStrategy(id)}
                title={cfg.description}
                className={`flex-1 py-1 px-1.5 rounded border text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  isSelected
                    ? "border-red-500 bg-red-500/15 text-foreground ring-1 ring-red-500/30"
                    : "border-border bg-card hover:bg-accent text-muted-foreground"
                }`}
              >
                <span className="text-sm leading-none">{cfg.icon}</span>
                <span>{cfg.label}</span>
                <kbd className="text-[9px] font-mono opacity-40 bg-black/10 dark:bg-white/10 rounded px-1 py-px">
                  {STRATEGY_SHORTCUTS[i].toUpperCase()}
                </kbd>
              </button>
            );
          })}
        </div>

        {/* Ability chips */}
        {currentPitcherAbilities.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto shrink-0">
            {currentPitcherAbilities.map((ability, i) => {
              const { canActivate, reason } = canActivateAbility(
                matchState.currentPitcher,
                ability.id,
              );
              const isSelected = selectedAbility === ability.id;
              const shortcut = ABILITY_SHORTCUT_KEYS[i];
              return (
                <button
                  key={ability.id}
                  onClick={() => setSelectedAbility(isSelected ? null : ability.id)}
                  disabled={!canActivate}
                  title={
                    !canActivate && reason
                      ? reason
                      : `${ability.description}${shortcut ? ` [${shortcut.toUpperCase()}]` : ""}`
                  }
                  className={`flex items-center gap-1 border rounded px-2 py-0.5 text-xs transition whitespace-nowrap ${
                    isSelected
                      ? "border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-500/20 ring-1 ring-blue-500/30 text-foreground"
                      : canActivate
                        ? "border-border bg-card hover:bg-accent text-foreground"
                        : "opacity-40 cursor-not-allowed border-border bg-card"
                  }`}
                >
                  <span>{ability.iconEmoji}</span>
                  <span className="font-medium">{ability.name}</span>
                  <span className="text-muted-foreground flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    {ability.spiritCost}
                  </span>
                  {shortcut && (
                    <kbd className="text-[9px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1 py-px">
                      {shortcut.toUpperCase()}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone grid — purely location aim, no row-strategy coupling */}
      {isGuaranteedAbility(selectedAbilityDef) ? (
        <Button
          size="lg"
          onClick={() => onSimulateAtBat()}
          className="w-full h-auto py-3 flex items-center justify-center gap-2"
        >
          <span className="text-xl leading-none">{selectedAbilityDef!.iconEmoji}</span>
          <span className="font-bold text-sm">{selectedAbilityDef!.name}</span>
        </Button>
      ) : (
        <div className="space-y-1">
          <ZoneGrid
            mode="pitching"
            zoneMap={zoneMap}
            onSelect={(cell) => {
              onSimulateAtBat(undefined, selectedStrategy, cell);
            }}
          />
          {(() => {
            const note = getExecutionNote(matchState.currentPitcher);
            return note ? (
              <div className="text-[9px] text-muted-foreground/60 leading-tight px-0.5">
                {note}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Selected ability description */}
      {selectedAbilityDef && (
        <div className="text-xs px-1 text-muted-foreground leading-snug">
          {selectedAbilityDef.iconEmoji}{" "}
          <span className="font-medium">{selectedAbilityDef.name}</span> —{" "}
          {selectedAbilityDef.description}
        </div>
      )}
    </div>
  );
}
