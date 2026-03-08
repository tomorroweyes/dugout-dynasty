/**
 * ActionBar.tsx — Game decision interface
 *
 * Unified architecture:
 * - Early exits: autoSim, pitcher feedback, results, inning complete
 * - Unified decision UI: handles both batting & pitching via mode flag
 * - Shared components: AbilityChip, DecisionSection, ZoneSelector
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/8bit/button";
import { Sparkles } from "lucide-react";
import { canActivateAbility } from "@/engine/abilitySystem";
import { BATTER_APPROACHES, PITCH_STRATEGIES } from "@/engine/approachConfig";
import type { InteractiveMatchState } from "@/engine/interactiveMatchEngine";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { Ability } from "@/types/ability";
import { SIM_MODE_LABELS, type SimMode } from "./constants";
import { ZoneGridDisplay } from "./ZoneGridDisplay";
import {
  getExecutionNote,
  type ZoneMap,
  type ZoneCell,
} from "@/engine/zoneSystem";

const ABILITY_SHORTCUT_KEYS = ["z", "x", "c"];
const APPROACH_SHORTCUTS = ["q", "w", "e"];
const APPROACH_ORDER: BatterApproach[] = ["power", "contact", "patient"];
const STRATEGY_ORDER: PitchStrategy[] = ["power", "mixed", "finesse"];

const OUTCOME_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  homerun: { icon: "🏠", label: "Home Run", color: "text-amber-400", bg: "bg-amber-950/40" },
  triple: { icon: "🔺", label: "Triple", color: "text-blue-400", bg: "bg-blue-950/40" },
  double: { icon: "⬆️", label: "Double", color: "text-cyan-400", bg: "bg-cyan-950/40" },
  single: { icon: "➡️", label: "Single", color: "text-green-400", bg: "bg-green-950/40" },
  walk: { icon: "🟡", label: "Walk", color: "text-yellow-400", bg: "bg-yellow-950/40" },
  strikeout: { icon: "🔴", label: "Strikeout", color: "text-red-400", bg: "bg-red-950/40" },
  groundout: { icon: "⚫", label: "Out", color: "text-slate-400", bg: "bg-slate-950/40" },
  flyout: { icon: "⚫", label: "Out", color: "text-slate-400", bg: "bg-slate-950/40" },
  lineout: { icon: "⚫", label: "Out", color: "text-slate-400", bg: "bg-slate-950/40" },
  popout: { icon: "⚫", label: "Out", color: "text-slate-400", bg: "bg-slate-950/40" },
  out: { icon: "⚫", label: "Out", color: "text-slate-400", bg: "bg-slate-950/40" },
};

function isGuaranteedAbility(ability: Ability | null): boolean {
  return ability?.effects.some((e) => e.type === "guaranteed_outcome") ?? false;
}

interface AbilityChipProps {
  ability: Ability;
  isSelected: boolean;
  canActivate: boolean;
  reason?: string;
  shortcut?: string;
  onClick: () => void;
  compact?: boolean;
}

/**
 * Shared ability chip — used for both batters & pitchers
 */
function AbilityChip({
  ability,
  isSelected,
  canActivate,
  reason,
  shortcut,
  onClick,
  compact = false,
}: AbilityChipProps) {
  const baseClass = `flex items-center gap-${compact ? "1" : "2"} border rounded ${
    compact ? "px-2 py-0.5 text-xs" : "px-3 py-2 text-sm"
  } font-medium transition whitespace-nowrap`;

  const selectedClass = compact
    ? "border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-500/20 ring-1 ring-blue-500/30 text-foreground"
    : "border-blue-500 dark:border-blue-400 bg-blue-500/15 dark:bg-blue-500/25 ring-2 ring-blue-500/50 text-foreground shadow-lg";

  const enabledClass = compact
    ? "border-border bg-card hover:bg-accent text-foreground"
    : "border-border bg-card hover:bg-accent hover:shadow-md text-foreground";

  const disabledClass = "opacity-50 cursor-not-allowed border-border bg-card";

  return (
    <button
      onClick={onClick}
      disabled={!canActivate}
      title={
        !canActivate && reason ? reason : `${ability.description}${shortcut ? ` [${shortcut.toUpperCase()}]` : ""}`
      }
      className={`${baseClass} ${isSelected ? selectedClass : canActivate ? enabledClass : disabledClass}`}
    >
      <span className={compact ? "text-sm" : "text-lg"}>{ability.iconEmoji}</span>
      <span>{ability.name}</span>
      <span className={`${compact ? "text-xs" : "text-xs"} text-muted-foreground flex items-center gap-0.5`}>
        <Sparkles className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        {ability.spiritCost}
      </span>
      {shortcut && (
        <kbd
          className={`font-mono opacity-${compact ? "50" : "60"} bg-${compact ? "black/10" : "black/20"} dark:bg-${
            compact ? "white/10" : "white/20"
          } rounded px-${compact ? "1" : "1.5"} py-${compact ? "px" : "0.5"} ${!compact && "ml-auto"}`}
        >
          {shortcut.toUpperCase()}
        </kbd>
      )}
    </button>
  );
}

interface DecisionSectionProps {
  /** "batting" or "pitching" */
  mode: "batting" | "pitching";
  /** Current selection (approach for batting, strategy for pitching) */
  selection: BatterApproach | PitchStrategy;
  setSelection: (s: BatterApproach | PitchStrategy) => void;
  selectedAbility: string | null;
  setSelectedAbility: (id: string | null) => void;
  abilities: Ability[];
  currentPlayer: any;
  selectedAbilityDef: Ability | null;
  zoneMap: ZoneMap;
  pitchHint?: ZoneCell[];
  onZoneSelect: (cell: ZoneCell) => void;
}

/**
 * Unified decision interface for batting & pitching
 * Handles approach/strategy selection, ability chips, and zone grid
 */
function DecisionSection({
  mode,
  selection,
  setSelection,
  selectedAbility,
  setSelectedAbility,
  abilities,
  currentPlayer,
  selectedAbilityDef,
  zoneMap,
  pitchHint,
  onZoneSelect,
}: DecisionSectionProps) {
  const isBatting = mode === "batting";

  // Decision options (approach or strategy)
  const options = isBatting
    ? APPROACH_ORDER.map((id, i) => ({
        id,
        config: BATTER_APPROACHES[id],
        shortcut: APPROACH_SHORTCUTS[i],
        isSelected: selection === id,
      }))
    : STRATEGY_ORDER.map((id, i) => ({
        id,
        config: PITCH_STRATEGIES[id],
        shortcut: APPROACH_SHORTCUTS[i],
        isSelected: selection === id,
      }));

  const selectionLabel = isBatting ? "Choose Approach" : "Special Abilities";
  const showShortcutHint = isBatting;

  const isGuaranteed = isGuaranteedAbility(selectedAbilityDef);

  return (
    <div className="h-full flex flex-col gap-1.5">
      {/* Decision context label */}
      <div className="shrink-0 text-xs text-muted-foreground font-medium">
        {selectionLabel}
        {showShortcutHint && <kbd className="text-[9px] font-mono opacity-50 ml-1">Q W E</kbd>}
      </div>

      {/* Selection buttons + ability chips */}
      <div className={`flex items-center gap-2 ${isBatting ? "min-h-7" : ""} shrink-0`}>
        {/* Approach/strategy buttons (batting only) */}
        {isBatting && (
          <div className="flex gap-1 flex-1">
            {options.map(({ id, config, shortcut, isSelected }) => (
              <button
                key={id}
                onClick={() => setSelection(id as BatterApproach)}
                title={config.description}
                className={`flex-1 py-1 px-1.5 rounded border text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/15 text-foreground ring-1 ring-blue-500/30"
                    : "border-border bg-card hover:bg-accent text-muted-foreground"
                }`}
              >
                <span className="text-sm leading-none">{config.icon}</span>
                <span>{config.label}</span>
                <kbd className="text-[9px] font-mono opacity-40 bg-black/10 dark:bg-white/10 rounded px-1 py-px">
                  {shortcut?.toUpperCase()}
                </kbd>
              </button>
            ))}
          </div>
        )}

        {/* Ability chips (both modes) */}
        {abilities.length > 0 && (
          <div className={`flex gap-${isBatting ? "1.5" : "2"} ${isBatting ? "overflow-x-auto" : "flex-wrap"} shrink-0`}>
            {abilities.map((ability, i) => {
              const { canActivate, reason } = canActivateAbility(currentPlayer, ability.id);
              const isSelected = selectedAbility === ability.id;
              const shortcut = ABILITY_SHORTCUT_KEYS[i];
              return (
                <AbilityChip
                  key={ability.id}
                  ability={ability}
                  isSelected={isSelected}
                  canActivate={canActivate}
                  reason={reason}
                  shortcut={shortcut}
                  onClick={() => setSelectedAbility(isSelected ? null : ability.id)}
                  compact={isBatting}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Zone grid or guaranteed ability button */}
      {isGuaranteed ? (
        <Button
          size="lg"
          onClick={() => onZoneSelect({ row: 1, col: 1 })}
          className="w-full h-auto py-3 flex items-center justify-center gap-2"
        >
          <span className="text-xl leading-none">{selectedAbilityDef!.iconEmoji}</span>
          <span className="font-bold text-sm">{selectedAbilityDef!.name}</span>
        </Button>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <ZoneGridDisplay
            mode={mode}
            zoneMap={zoneMap}
            pitchHint={pitchHint}
            fillHeight
            onSelect={onZoneSelect}
          />
          {!isBatting && (() => {
            const note = getExecutionNote(currentPlayer);
            return note ? (
              <div className="text-xs text-muted-foreground leading-tight px-0.5 mt-1 shrink-0">
                {note}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Ability description */}
      {selectedAbilityDef && (
        <div className="text-xs px-1 text-muted-foreground leading-snug shrink-0">
          {selectedAbilityDef.iconEmoji}{" "}
          <span className="font-medium">{selectedAbilityDef.name}</span> — {selectedAbilityDef.description}
        </div>
      )}
    </div>
  );
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
  const [selectedApproach, setSelectedApproach] = useState<BatterApproach>(
    inningGamePlan ?? matchState.lastBatterApproach ?? "contact",
  );
  const [selectedStrategy, setSelectedStrategy] = useState<PitchStrategy>(
    matchState.lastPitchStrategy ?? "finesse",
  );
  const [pitcherSelection, setPitcherSelection] = useState<ZoneCell | null>(null);
  const [batterSelection, setBatterSelection] = useState<ZoneCell | null>(null);

  // Zone result shows when: result arrived and player selected a zone (either mode)
  const shouldShowZoneResult =
    showingResult && ((!isMyBatter && pitcherSelection !== null) || (isMyBatter && batterSelection !== null));

  // q/w/e keyboard shortcuts for approach (batting) or strategy (pitching)
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

  // ─── EARLY EXITS ────────────────────────────────────────────────────────

  // Currently simulating at-bat
  if (autoSimulating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <div className="text-sm font-medium animate-pulse">
          {simMode ? SIM_MODE_LABELS[simMode] : "Simulating"}...
        </div>
      </div>
    );
  }

  // ─── ZONE RESULT (batting OR pitching — player selected a zone) ─────────────
  // Grid stays visible; overlays show pitch location (⚾) vs read zone (👀)
  if (shouldShowZoneResult) {
    const lastPlay = matchState.playByPlay[matchState.playByPlay.length - 1];
    if (lastPlay) {
      const meta = OUTCOME_META[lastPlay.outcome] ?? OUTCOME_META.out;
      const isMoment = lastPlay.paintedCorner || lastPlay.perfectContact;
      const isHit = ["homerun", "triple", "double", "single"].includes(lastPlay.outcome);
      const mode = isMyBatter ? "batting" : "pitching";

      // In both modes:
      //   zoneAimed       = where pitch went (pitcher's aim / player's aim)
      //   zoneBatterAimed = the "read" zone (player's prediction when batting /
      //                     AI batter's expected zone when pitching)
      const pitchLocation = lastPlay.zoneLanded ?? lastPlay.zoneAimed;
      const readZone = lastPlay.zoneBatterAimed;

      // Read chess result
      const readCorrect =
        pitchLocation &&
        readZone &&
        pitchLocation.row === readZone.row &&
        pitchLocation.col === readZone.col;

      const chessResult: { label: string; detail: string; color: string } | null =
        !pitchLocation || !readZone
          ? null
          : isMyBatter
          ? // Batting: did player predict where pitch came?
            readCorrect && isHit
            ? { label: "You called it", detail: "Pitch came right where you looked", color: "text-green-400" }
            : readCorrect
            ? { label: "Good read — bad contact", detail: "Right zone, wrong result", color: "text-amber-400" }
            : { label: "Missed the read", detail: "Pitch came somewhere else", color: "text-orange-400" }
          : // Pitching: did pitcher fool the batter?
            !readCorrect
          ? { label: "Fooled him", detail: "Threw where he wasn't looking", color: "text-green-400" }
          : isHit
          ? { label: "He read it right", detail: "Was sitting on that zone — capitalized", color: "text-red-400" }
          : { label: "He guessed right — missed anyway", detail: "Good location held up", color: "text-amber-400" };

      const continueLabel = matchState.isComplete
        ? "See Final Score"
        : matchState.inningComplete
        ? "Next Inning"
        : "Next Batter";

      return (
        <div className="h-full flex flex-col gap-2 p-3">
          {/* Outcome card + chess read result */}
          <div className={`rounded-lg border px-3 py-2.5 shrink-0 ${meta.bg}`}>
            <div className="flex items-center gap-3">
              {/* Outcome icon + label */}
              <div className="shrink-0 text-center min-w-[3rem]">
                <div className="text-2xl leading-none">{meta.icon}</div>
                <div className={`text-[11px] font-bold uppercase tracking-wide mt-0.5 ${meta.color}`}>
                  {meta.label}
                  {isMoment && <span className="ml-0.5 text-amber-400">✨</span>}
                </div>
                {isHit && lastPlay.rbi != null && lastPlay.rbi > 0 && (
                  <div className="text-[10px] text-muted-foreground">{lastPlay.rbi} RBI</div>
                )}
              </div>

              {/* Chess result */}
              {chessResult && (
                <div className="flex-1 min-w-0 border-l border-border/40 pl-3">
                  <div className={`text-xs font-bold leading-tight ${chessResult.color}`}>
                    {chessResult.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {chessResult.detail}
                  </div>
                </div>
              )}

              {/* Narrative */}
              {lastPlay.narrativeText && (
                <p className="text-[11px] text-muted-foreground italic leading-snug line-clamp-2 flex-1 min-w-0 border-l border-border/40 pl-3">
                  "{lastPlay.narrativeText}"
                </p>
              )}
            </div>
          </div>

          {/* Zone grid — shows ⚾ pitch location + 👀 read zone */}
          <div className="flex-1 min-h-0">
            {pitchLocation ? (
              <ZoneGridDisplay
                mode={mode}
                zoneMap={zoneMap}
                fillHeight
                resultData={{
                  aimed: pitchLocation,
                  landingZone: pitchLocation,
                  batterSwing: readZone,
                  isPerfect: isMoment ?? false,
                }}
              />
            ) : (
              // Fallback: no zone data — show disabled grid
              <ZoneGridDisplay
                mode={mode}
                zoneMap={zoneMap}
                fillHeight
                disabled
                onSelect={() => {}}
              />
            )}
          </div>

          {/* Continue */}
          <Button
            size="lg"
            onClick={() => {
              setPitcherSelection(null);
              setBatterSelection(null);
              onContinue();
            }}
            className="w-full py-5 shrink-0"
          >
            {continueLabel}
            <kbd className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
              Space
            </kbd>
          </Button>
        </div>
      );
    }
  }

  // ─── TEXT-ONLY RESULT (auto-simulated play, no zone selected) ────────────────
  if (showingResult) {
    const lastPlay = matchState.playByPlay[matchState.playByPlay.length - 1];
    const meta = lastPlay ? (OUTCOME_META[lastPlay.outcome] ?? OUTCOME_META.out) : OUTCOME_META.out;
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
      <div className="h-full flex flex-col gap-2 py-1">
        {/* Outcome headline */}
        <div className={`text-center py-2 px-3 rounded-lg shrink-0 ${meta.bg}`}>
          <div className="text-xl mb-0.5 leading-none">{meta.icon}</div>
          <div className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>
            {meta.label}
            {isMoment && <span className="ml-1 text-amber-400">✨</span>}
          </div>
          {isHit && lastPlay?.rbi != null && lastPlay.rbi > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">{lastPlay.rbi} RBI</div>
          )}
        </div>

        {/* Narrative text */}
        {lastPlay?.narrativeText && (
          <p className="text-xs text-muted-foreground italic text-center px-1 leading-snug line-clamp-2 shrink-0">
            "{lastPlay.narrativeText}"
          </p>
        )}

        {/* Score + situation */}
        <div className="flex items-center justify-between px-1 mt-auto shrink-0">
          <span className="font-mono font-bold text-sm tabular-nums">
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

  // Inning complete display
  if (matchState.inningComplete) {
    const lastPlay = matchState.playByPlay[matchState.playByPlay.length - 1];
    const halfInningPlays = lastPlay
      ? matchState.playByPlay.filter((p) => p.inning === lastPlay.inning && p.isTop === lastPlay.isTop)
      : [];

    const runsThisHalf = halfInningPlays.reduce((sum, p) => sum + (p.rbi ?? 0), 0);
    const myTeamBatted = !matchState.isTop;

    const myBefore = myTeamBatted ? matchState.myRuns - runsThisHalf : matchState.myRuns;
    const theirBefore = myTeamBatted ? matchState.opponentRuns : matchState.opponentRuns - runsThisHalf;
    const nowTied = matchState.myRuns === matchState.opponentRuns;
    const weLeadNow = matchState.myRuns > matchState.opponentRuns;
    const leadChanged =
      (myTeamBatted && (theirBefore > myBefore || (theirBefore === myBefore && runsThisHalf > 0)) && weLeadNow) ||
      (!myTeamBatted && (myBefore > theirBefore || (myBefore === theirBefore && runsThisHalf > 0)) && !weLeadNow && !nowTied);
    const leadTied = myBefore !== theirBefore && nowTied && runsThisHalf > 0;

    const halfLabel = matchState.isTop ? "Top" : "Bottom";
    const halfEndLabel = matchState.isTop ? "Middle" : "End";
    const scoreLine = `${matchState.myRuns} – ${matchState.opponentRuns}`;

    // Play classification
    const PLAY_ICONS: Record<string, string> = {
      homerun: "🏠",
      triple: "🔺",
      double: "⬆️",
      single: "➡️",
      walk: "🟡",
      strikeout: "🔴",
      groundout: "⚫",
      flyout: "⚫",
      lineout: "⚫",
      popout: "⚫",
    };
    const OUTCOME_LABELS: Record<string, string> = {
      homerun: "homer",
      triple: "triple",
      double: "double",
      single: "single",
      walk: "walk",
      strikeout: "K",
      groundout: "out",
      flyout: "out",
      lineout: "out",
      popout: "out",
    };
    const isScoring = (rbi?: number) => (rbi ?? 0) > 0;
    const isHit = (o: string) => ["homerun", "triple", "double", "single"].includes(o);
    const isOut = (o: string) => ["groundout", "flyout", "lineout", "popout", "strikeout"].includes(o);

    // Dark mode color tokens
    const myHeaderBg = "bg-amber-500/20 dark:bg-amber-500/15 border-amber-400/50 dark:border-amber-400/35";
    const myRowBg = "bg-amber-500/15 dark:bg-amber-500/12 border border-amber-400/30 dark:border-amber-400/20";
    const myNameText = "text-amber-800 dark:text-amber-300";
    const myBadgeEl = "bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-400/30";

    const theirHeaderBg = "bg-red-500/15 dark:bg-red-500/12 border-red-400/40 dark:border-red-400/30";
    const theirRowBg = "bg-red-500/12 dark:bg-red-500/10 border border-red-400/25 dark:border-red-400/18";
    const theirNameText = "text-red-800 dark:text-red-300";
    const theirBadgeEl = "bg-red-100 dark:bg-red-400/15 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-400/30";

    const neutralHeaderBg = "bg-card border-border";
    const rowBg = myTeamBatted ? myRowBg : theirRowBg;
    const nameText = myTeamBatted ? myNameText : theirNameText;
    const badgeEl = myTeamBatted ? myBadgeEl : theirBadgeEl;
    const headerBg = runsThisHalf > 0 ? (myTeamBatted ? myHeaderBg : theirHeaderBg) : neutralHeaderBg;
    const deltaText = myTeamBatted ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300";

    return (
      <div className="h-full flex flex-col gap-2 py-1">
        {/* Header */}
        <div className={`shrink-0 rounded-lg border px-3 py-2.5 ${headerBg}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {halfEndLabel} · {halfLabel} {matchState.inning}
            </span>
            {leadChanged && (
              <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${myTeamBatted ? myBadgeEl : theirBadgeEl}`}>
                {myTeamBatted ? "↑ Lead taken" : "↓ Lead lost"}
              </span>
            )}
            {leadTied && !leadChanged && (
              <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-400/15 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-400/30">
                Tied
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono font-bold text-2xl tabular-nums text-foreground">{scoreLine}</span>
            {runsThisHalf > 0 ? (
              <span className={`text-sm font-bold ${deltaText}`}>+{runsThisHalf} {runsThisHalf === 1 ? "run" : "runs"}</span>
            ) : (
              <span className="text-sm text-muted-foreground">no runs</span>
            )}
          </div>
        </div>

        {/* Plays */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
          {halfInningPlays.map((play, i) => {
            const icon = PLAY_ICONS[play.outcome] ?? "⚪";
            const scoring = isScoring(play.rbi);

            if (scoring) {
              return (
                <div key={i} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md ${rowBg}`}>
                  <span className="text-lg leading-none shrink-0">{icon}</span>
                  <span className={`text-sm font-semibold flex-1 truncate ${nameText}`}>{play.batter}</span>
                  <span className={`text-xs font-bold shrink-0 px-1.5 py-0.5 rounded ${badgeEl}`}>+{play.rbi}</span>
                </div>
              );
            }

            return (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 text-muted-foreground text-xs">
                <span className="text-sm leading-none shrink-0">{icon}</span>
                <span className="flex-1 truncate">{play.batter}</span>
                <span className="shrink-0 opacity-60">{OUTCOME_LABELS[play.outcome]}</span>
              </div>
            );
          })}
        </div>

        {/* Next button */}
        <Button size="lg" onClick={onContinue} className="w-full py-5 text-sm">
          {matchState.isComplete ? "See Final Score" : `Next ${matchState.isTop ? "Half" : "Inning"}`}
          {" ›"}
          <kbd className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
            Space
          </kbd>
        </Button>
      </div>
    );
  }

  // ─── NORMAL DECISION STATE ──────────────────────────────────────────

  return (
    <DecisionSection
      mode={isMyBatter ? "batting" : "pitching"}
      selection={isMyBatter ? selectedApproach : selectedStrategy}
      setSelection={(s) => {
        if (isMyBatter) {
          setSelectedApproach(s as BatterApproach);
        } else {
          setSelectedStrategy(s as PitchStrategy);
        }
      }}
      selectedAbility={selectedAbility}
      setSelectedAbility={setSelectedAbility}
      abilities={isMyBatter ? currentBatterAbilities : currentPitcherAbilities}
      currentPlayer={isMyBatter ? matchState.currentBatter : matchState.currentPitcher}
      selectedAbilityDef={selectedAbilityDef}
      zoneMap={zoneMap}
      pitchHint={pitchHint}
      onZoneSelect={(cell) => {
        if (isMyBatter) {
          setBatterSelection(cell);
          onSimulateAtBat(selectedApproach, undefined, cell);
        } else {
          setPitcherSelection(cell);
          onSimulateAtBat(undefined, selectedStrategy, cell);
        }
      }}
    />
  );
}
