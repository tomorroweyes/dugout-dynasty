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
    return (
      <div className="h-full flex items-center justify-center">
        <Button
          size="lg"
          onClick={onContinue}
          className="w-full py-6 text-base"
        >
          {matchState.isComplete
            ? "See Final Score"
            : matchState.inningComplete
              ? "Next Inning"
              : "Next Batter"}
          {" ›"}
          <kbd className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
            Space
          </kbd>
        </Button>
      </div>
    );
  }

  if (matchState.inningComplete) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        {matchState.isTop ? "Middle" : "End"} of Inning {matchState.inning}...
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
