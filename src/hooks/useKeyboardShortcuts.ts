import { useEffect } from "react";
import { canActivateAbility } from "@/engine/abilitySystem";
import { finalizeInteractiveMatch } from "@/engine/interactiveMatchEngine";
import type { InteractiveMatchState } from "@/engine/interactiveMatchEngine";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { MatchResult } from "@/types/game";
import type { Ability } from "@/types/ability";
import type { Player } from "@/types/game";

const BATTER_APPROACH_KEYS: BatterApproach[] = ["power", "contact", "patient"];
const PITCH_STRATEGY_KEYS: PitchStrategy[] = ["challenge", "finesse", "paint"];
const ABILITY_SHORTCUT_KEYS = ["z", "x", "c"];

interface KeyboardShortcutsOptions {
  autoSimulating: boolean;
  showingResult: boolean;
  matchState: InteractiveMatchState;
  isMyBatter: boolean;
  selectedAbility: string | null;
  setSelectedAbility: (id: string | null) => void;
  activeAbilities: Ability[];
  activePlayer: Player;
  onSimulateAtBat: (approach?: BatterApproach, strategy?: PitchStrategy) => void;
  onContinue: () => void;
  onComplete: (result: MatchResult) => void;
  matchRewards?: { win: number; loss: number };
  fans?: number;
  /** Disables 1/2/3 action shortcuts (e.g. when the game plan selector is showing) */
  disableActionShortcuts?: boolean;
}

export function useKeyboardShortcuts({
  autoSimulating,
  showingResult,
  matchState,
  isMyBatter,
  selectedAbility,
  setSelectedAbility,
  activeAbilities,
  activePlayer,
  onSimulateAtBat,
  onContinue,
  onComplete,
  matchRewards,
  fans,
  disableActionShortcuts = false,
}: KeyboardShortcutsOptions): void {
  useEffect(() => {
    if (autoSimulating) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      // Space/Enter to continue through transitions and final score
      if (key === " " || key === "enter") {
        if (showingResult) {
          e.preventDefault();
          onContinue();
          return;
        }
        if (matchState.isComplete && !showingResult) {
          e.preventDefault();
          onComplete(finalizeInteractiveMatch(matchState, matchRewards, fans));
          return;
        }
      }

      // All other shortcuts only active during gameplay
      if (showingResult || matchState.isComplete || matchState.inningComplete) return;

      // Approach/strategy shortcuts: 1/2/3 or Q/W/E
      let actionIndex = -1;
      if (key === "1" || key === "q") actionIndex = 0;
      else if (key === "2" || key === "w") actionIndex = 1;
      else if (key === "3" || key === "e") actionIndex = 2;

      if (actionIndex !== -1 && !disableActionShortcuts) {
        e.preventDefault();
        if (isMyBatter) {
          onSimulateAtBat(BATTER_APPROACH_KEYS[actionIndex]);
        } else {
          onSimulateAtBat(undefined, PITCH_STRATEGY_KEYS[actionIndex]);
        }
        return;
      }

      // Ability toggle shortcuts: Z/X/C
      const abilityIndex = ABILITY_SHORTCUT_KEYS.indexOf(key);
      if (abilityIndex !== -1 && abilityIndex < activeAbilities.length) {
        e.preventDefault();
        const ability = activeAbilities[abilityIndex];
        const { canActivate } = canActivateAbility(activePlayer, ability.id);
        if (canActivate) {
          setSelectedAbility(selectedAbility === ability.id ? null : ability.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    autoSimulating,
    showingResult,
    matchState.isComplete,
    matchState.inningComplete,
    isMyBatter,
    selectedAbility,
    matchState,
    activeAbilities,
    activePlayer,
    onSimulateAtBat,
    onContinue,
    onComplete,
    matchRewards,
    fans,
    setSelectedAbility,
    disableActionShortcuts,
  ]);
}
