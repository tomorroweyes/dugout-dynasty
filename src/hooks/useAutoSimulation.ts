import { useState } from "react";
import * as React from "react";
import {
  InteractiveMatchState,
  finalizeInteractiveMatch,
  simulateAtBat_Interactive,
} from "@/engine/interactiveMatchEngine";
import { decideBatterApproach, decidePitchStrategy } from "@/engine/approachAI";
import { decideBatterAbility, decidePitcherAbility } from "@/engine/abilityAI";
import { isHighLeverage } from "@/engine/leverageCalculator";
import type { AtBatDecision } from "@/engine/interactiveMatchEngine";
import type { MatchResult } from "@/types/game";
import type { BatterApproach } from "@/types/approach";
import type { SimMode } from "@/components/match/constants";

interface AutoSimulationOptions {
  matchRewards?: { win: number; loss: number };
  fans?: number;
  onComplete: (result: MatchResult) => void;
  setMatchState: React.Dispatch<React.SetStateAction<InteractiveMatchState>>;
  setShowingResult: (b: boolean) => void;
  setLastRunsScored: (n: number) => void;
  setFieldMarker: (m: { x: number; y: number; type: string } | null) => void;
}

export function useAutoSimulation({
  matchRewards,
  fans,
  onComplete,
  setMatchState,
  setShowingResult,
  setLastRunsScored,
  setFieldMarker,
}: AutoSimulationOptions) {
  const [autoSimulating, setAutoSimulating] = useState(false);
  const [simMode, setSimMode] = useState<SimMode | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup: clear interval on unmount
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleAutoSim = (mode: SimMode, matchState: InteractiveMatchState, gamePlan?: BatterApproach) => {
    if (autoSimulating) return; // Guard against double-start

    // Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setAutoSimulating(true);
    setSimMode(mode);
    setShowingResult(false);
    setLastRunsScored(0);
    setFieldMarker(null);

    // Capture starting state synchronously for stop-condition checks
    const startInning = matchState.inning;
    const startIsTop = matchState.isTop;

    const interval = setInterval(() => {
      setMatchState((prev) => {
        // Check stop conditions
        const shouldStop = (() => {
          if (prev.isComplete) return true;
          switch (mode) {
            case "gamePlan":
              // Stop at half-inning boundary
              if (prev.isTop !== startIsTop || prev.inning !== startInning) return true;
              // Stop at high-leverage moments so player can make an explicit call
              return isHighLeverage(prev);
            case "half":
              return prev.isTop !== startIsTop || prev.inning !== startInning;
            case "inning":
              return prev.inning !== startInning;
            case "runners":
              return prev.bases.filter(Boolean).length >= 2;
            case "end":
            default:
              return false;
          }
        })();

        if (shouldStop) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setAutoSimulating(false);
          setSimMode(null);
          // Match complete — show game summary screen, let user click Continue to trigger onComplete
          // (Don't auto-call onComplete; user must acknowledge the result)
          return prev;
        }

        // AI decides all abilities and approach/strategy during auto-sim
        const decision: AtBatDecision = {};

        // For "gamePlan" mode, use the player's chosen game plan when their team is batting
        if (mode === "gamePlan" && !prev.isTop && gamePlan) {
          decision.batterApproach = gamePlan;
        } else {
          decision.batterApproach = decideBatterApproach(
            {
              outs: prev.outs,
              bases: prev.bases,
              myScore: prev.isTop ? prev.opponentRuns : prev.myRuns,
              opponentScore: prev.isTop ? prev.myRuns : prev.opponentRuns,
              inning: prev.inning,
              pitcherInningsPitched: prev.isTop
                ? prev.myPitcherInnings
                : prev.opponentPitcherInnings,
              batterPower:
                "power" in prev.currentBatter.stats
                  ? prev.currentBatter.stats.power
                  : undefined,
              batterContact:
                "power" in prev.currentBatter.stats
                  ? prev.currentBatter.stats.contact
                  : undefined,
              lastApproach: prev.lastBatterApproach ?? undefined,
              consecutiveCount: prev.consecutiveBatterApproach,
            },
            prev.rng,
          );
        }

        decision.pitchStrategy = decidePitchStrategy(
          {
            outs: prev.outs,
            bases: prev.bases,
            myScore: prev.isTop ? prev.myRuns : prev.opponentRuns,
            opponentScore: prev.isTop ? prev.opponentRuns : prev.myRuns,
            inning: prev.inning,
            batterPower:
              "power" in prev.currentBatter.stats
                ? prev.currentBatter.stats.power
                : undefined,
            batterContact:
              "power" in prev.currentBatter.stats
                ? prev.currentBatter.stats.contact
                : undefined,
            lastStrategy: prev.lastPitchStrategy ?? undefined,
            consecutiveCount: prev.consecutivePitchStrategy,
          },
          prev.rng,
        );

        const batterAbility = decideBatterAbility({
          player: prev.currentBatter,
          random: prev.rng,
        });
        if (batterAbility) {
          decision.batterAbility = batterAbility;
        }

        const pitcherAbility = decidePitcherAbility({
          player: prev.currentPitcher,
          random: prev.rng,
        });
        if (pitcherAbility) {
          decision.pitcherAbility = pitcherAbility;
        }

        return simulateAtBat_Interactive(prev, decision);
      });
    }, 200);

    intervalRef.current = interval;
  };

  return { autoSimulating, simMode, handleAutoSim };
}
