import { useState, useEffect, useRef, useMemo } from "react";
import {
  InteractiveMatchState,
  AtBatDecision,
  simulateAtBat_Interactive,
  finalizeInteractiveMatch,
  type PitcherFatigueLevel,
} from "@/engine/interactiveMatchEngine";
import { Card } from "@/components/ui/8bit/card";
import { Button } from "@/components/ui/8bit/button";
import { getPlayerAbilities, getScaledAbilityEffects } from "@/engine/abilitySystem";
import { decidePitcherAbility, decideBatterAbility } from "@/engine/abilityAI";
import { decideBatterApproach, decidePitchStrategy } from "@/engine/approachAI";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import type { MatchResult } from "@/types/game";
import { useAutoSimulation } from "@/hooks/useAutoSimulation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTelemetryStore } from "@/store/telemetryStore";
import { GAME_CONSTANTS } from "@/engine/constants";
import { generatePostMatchInsights } from "@/engine/postMatchInsights";
import { MatchHeader } from "./match/MatchHeader";
import { DiamondField } from "./match/DiamondField";
import { PlayByPlayLog } from "./match/PlayByPlayLog";
import { MatchupCard } from "./match/MatchupCard";
import { ActionBar } from "./match/ActionBar";
import { TacticalPlanSelector } from "./match/TacticalPlanSelector";
import { PostMatchInsightCards } from "./PostMatchInsightCards";
import { BigMomentOverlay, type BigMoment } from "./match/BigMomentOverlay";

import { FIELD_POSITIONS, TEXT_MARKERS, type SimMode } from "./match/constants";
import { isHighLeverage } from "@/engine/leverageCalculator";
import {
  deriveZoneMap,
  derivePitchTendency,
  resolvePitchLanding,
  calcBattingZoneModifier,
  type ZoneCell,
  type ZoneMap,
  type ZoneModifier,
} from "@/engine/zoneSystem";
// ZoneResultOverlay removed — zone result is embedded in ActionBar result card

interface InteractiveMatchViewProps {
  initialState: InteractiveMatchState;
  onComplete: (result: MatchResult) => void;
  matchRewards?: { win: number; loss: number };
  fans?: number;
}

export function InteractiveMatchView({
  initialState,
  onComplete,
  matchRewards,
  fans,
}: InteractiveMatchViewProps) {
  const [matchState, setMatchState] = useState<InteractiveMatchState>(initialState);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [selectedSimMode, setSelectedSimMode] = useState<SimMode>("inning");
  const [showingResult, setShowingResult] = useState(false);
  const [lastRunsScored, setLastRunsScored] = useState(0);
  const [bigMoment, setBigMoment] = useState<BigMoment | null>(null);
  const [inningGamePlan, setInningGamePlan] = useState<BatterApproach | null>(null);
  const [fieldMarker, setFieldMarker] = useState<{
    x: number;
    y: number;
    type: string;
  } | null>(null);

  const [lastZonePlay, setLastZonePlay] = useState<{
    aimed: ZoneCell;
    zoneMap: ZoneMap;
    result: ZoneModifier;
    isMyBatter: boolean;
    batterSwing?: ZoneCell;
  } | null>(null);

  // Derived values
  const isMyBatter = !matchState.isTop;
  const myTeamColor = matchState.myTeamColor?.replace("#", "");
  const opponentTeamColor = matchState.opponentTeamColor?.replace("#", "");

  const currentBatterAbilities =
    isMyBatter && matchState.currentBatter.class && matchState.currentBatter.abilities
      ? getPlayerAbilities(matchState.currentBatter)
      : [];

  const currentPitcherAbilities =
    !isMyBatter && matchState.currentPitcher.class && matchState.currentPitcher.abilities
      ? getPlayerAbilities(matchState.currentPitcher)
      : [];

  const activeAbilities = isMyBatter ? currentBatterAbilities : currentPitcherAbilities;
  const activePlayer = isMyBatter ? matchState.currentBatter : matchState.currentPitcher;
  const trackAtBatDecision = useTelemetryStore((state) => state.trackAtBatDecision);
  const trackPostMatchInsight = useTelemetryStore((state) => state.trackPostMatchInsight);

  const decisionStartRef = useRef<number | null>(null);
  const atBatKeyRef = useRef<string>("");

  const selectedAbilityDef = selectedAbility
    ? (currentBatterAbilities.find((a) => a.id === selectedAbility) ??
      currentPitcherAbilities.find((a) => a.id === selectedAbility) ??
      null)
    : null;

  const finalResult = useMemo(() => {
    if (!matchState.isComplete) return null;
    return finalizeInteractiveMatch(matchState, matchRewards, fans);
  }, [matchState, matchRewards, fans]);

  const postMatchInsights = useMemo(() => {
    if (!finalResult) return [];
    return generatePostMatchInsights(finalResult);
  }, [finalResult]);

  // Zone map for current batter (hot/cold zones derived from stats)
  const currentZoneMap = useMemo(
    () => deriveZoneMap(matchState.currentBatter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchState.currentBatter.id]
  );

  // Pitch tendency hint cells (batting view only)
  const currentPitchHint = useMemo(
    () => (isMyBatter ? derivePitchTendency(matchState.currentPitcher) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchState.currentPitcher.id, isMyBatter]
  );

  // Inning transitions now require user input (ActionBar shows summary + button).
  // handleContinue clears both showingResult and inningComplete.

  // Auto-scroll play log to bottom
  const playLogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (playLogRef.current) {
      playLogRef.current.scrollTop = playLogRef.current.scrollHeight;
    }
  }, [matchState.playByPlay.length]);

  // ScoringFlash removed — runs scored are shown in zone result card, play log,
  // and score header. The sliding banner was too noisy for non-homer scoring.

  // Auto-simulation hook (declared before game-plan effects that reference handleAutoSim)
  const { autoSimulating, simMode, handleAutoSim } = useAutoSimulation({
    setMatchState,
    setShowingResult,
    setLastRunsScored,
    setFieldMarker,
  });

  // Reset game plan when the half-inning changes (new batting half = new plan)
  useEffect(() => {
    setInningGamePlan(null);
  }, [matchState.inning, matchState.isTop]);

  // Auto-advance: my team batting with a game plan + low leverage → auto-sim
  useEffect(() => {
    if (autoSimulating || showingResult || matchState.inningComplete || matchState.isComplete) return;
    if (matchState.isTop) return; // Not my team's batting half
    if (!inningGamePlan) return; // No plan set — show game plan selector

    // In close games (≤2 runs) from inning 7 onward, always give the player
    // manual control when batting. WE-based leverage reads LOW when you're
    // winning — the Poisson model correctly says "you're already likely to win,
    // each run adds little WE" — but that's the wrong signal for game feel.
    // A 2-1 game in the 8th should feel tense both offensively AND defensively.
    const runDiff = Math.abs(matchState.myRuns - matchState.opponentRuns);
    if (runDiff <= 2 && matchState.inning >= 7) return;

    if (isHighLeverage(matchState)) return; // Clutch situation — let player decide

    const t = setTimeout(() => handleAutoSim("gamePlan", matchState, inningGamePlan), 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState, autoSimulating, showingResult, inningGamePlan]);

  // Auto-advance: opponent batting + low leverage → auto-sim (no plan needed)
  useEffect(() => {
    if (autoSimulating || showingResult || matchState.inningComplete || matchState.isComplete) return;
    if (!matchState.isTop) return; // Not opponent's batting half
    if (isHighLeverage(matchState)) return; // Clutch situation — let player make pitch call

    const t = setTimeout(() => handleAutoSim("gamePlan", matchState, undefined), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState, autoSimulating, showingResult]);

  // Capture decision window start timestamps for atBatDecisionMs telemetry
  useEffect(() => {
    const isDecisionWindowOpen =
      !autoSimulating &&
      !showingResult &&
      !matchState.inningComplete &&
      !matchState.isComplete;

    if (!isDecisionWindowOpen) {
      decisionStartRef.current = null;
      atBatKeyRef.current = "";
      return;
    }

    const atBatKey = [
      matchState.inning,
      matchState.isTop ? "T" : "B",
      matchState.outs,
      matchState.batterIndex,
      matchState.playByPlay.length,
    ].join("-");

    if (atBatKey !== atBatKeyRef.current) {
      atBatKeyRef.current = atBatKey;
      decisionStartRef.current = Date.now();
    }
  }, [
    autoSimulating,
    showingResult,
    matchState.inningComplete,
    matchState.isComplete,
    matchState.inning,
    matchState.isTop,
    matchState.outs,
    matchState.batterIndex,
    matchState.playByPlay.length,
  ]);

  // Core at-bat handler — central game logic
  const handleSimulateAtBat = (approach?: BatterApproach, strategy?: PitchStrategy, aimedZone?: ZoneCell) => {
    if (matchState.isComplete) return;

    const decisionStartedAt = decisionStartRef.current;
    const decisionMs = decisionStartedAt ? Math.max(0, Date.now() - decisionStartedAt) : 0;

    const selectedApproach = approach;
    const selectedStrategy = strategy;

    const approachRepeatStreak = selectedApproach
      ? selectedApproach === matchState.lastBatterApproach
        ? matchState.consecutiveBatterApproach + 1
        : 1
      : 0;

    const strategyRepeatStreak = selectedStrategy
      ? selectedStrategy === matchState.lastPitchStrategy
        ? matchState.consecutivePitchStrategy + 1
        : 1
      : 0;

    const adaptationScale = GAME_CONSTANTS.ADAPTATION.PENALTY_SCALE;
    const approachEffectiveness =
      approachRepeatStreak > 0
        ? adaptationScale[
            Math.min(Math.max(approachRepeatStreak - 1, 0), adaptationScale.length - 1)
          ]
        : 1;
    const strategyEffectiveness =
      strategyRepeatStreak > 0
        ? adaptationScale[
            Math.min(Math.max(strategyRepeatStreak - 1, 0), adaptationScale.length - 1)
          ]
        : 1;

    const adaptationPenaltyExposure =
      (approachEffectiveness < 1 ? 1 : 0) + (strategyEffectiveness < 1 ? 1 : 0);

    trackAtBatDecision({
      timestamp: Date.now(),
      inning: matchState.inning,
      isTop: matchState.isTop,
      decisionMs,
      approach: selectedApproach,
      strategy: selectedStrategy,
      approachRepeatStreak,
      strategyRepeatStreak,
      adaptationPenaltyExposure,
    });

    let decision: AtBatDecision = {};

    if (isMyBatter) {
      decision.batterApproach = approach;
      decision.pitchStrategy = decidePitchStrategy(
        {
          outs: matchState.outs,
          bases: matchState.bases,
          myScore: matchState.opponentRuns,
          opponentScore: matchState.myRuns,
          inning: matchState.inning,
          batterPower:
            "power" in matchState.currentBatter.stats
              ? matchState.currentBatter.stats.power
              : undefined,
          batterContact:
            "power" in matchState.currentBatter.stats
              ? matchState.currentBatter.stats.contact
              : undefined,
          lastStrategy: matchState.lastPitchStrategy ?? undefined,
          consecutiveCount: matchState.consecutivePitchStrategy,
        },
        matchState.rng,
      );

      if (selectedAbility) {
        const playerAbility = matchState.currentBatter.abilities.find(
          (a) => a.abilityId === selectedAbility,
        );
        if (playerAbility) {
          const scaledAbility = getScaledAbilityEffects(selectedAbility, playerAbility.rank);
          if (scaledAbility) {
            decision.batterAbility = {
              playerId: matchState.currentBatter.id,
              abilityId: selectedAbility,
              effects: scaledAbility.effects,
              activatedAt: "pre_at_bat",
            };
          }
        }
      }

      const pitcherAbility = decidePitcherAbility({
        player: matchState.currentPitcher,
        random: matchState.rng,
      });
      if (pitcherAbility) {
        decision.pitcherAbility = pitcherAbility;
      }
    } else {
      decision.pitchStrategy = strategy;
      decision.batterApproach = decideBatterApproach(
        {
          outs: matchState.outs,
          bases: matchState.bases,
          myScore: matchState.opponentRuns,
          opponentScore: matchState.myRuns,
          inning: matchState.inning,
          pitcherInningsPitched: matchState.myPitcherInnings,
          lastApproach: matchState.lastBatterApproach ?? undefined,
          consecutiveCount: matchState.consecutiveBatterApproach,
        },
        matchState.rng,
      );

      const batterAbility = decideBatterAbility({
        player: matchState.currentBatter,
        random: matchState.rng,
      });
      if (batterAbility) {
        decision.batterAbility = batterAbility;
      }

      if (selectedAbility) {
        const playerAbility = matchState.currentPitcher.abilities.find(
          (a) => a.abilityId === selectedAbility,
        );
        if (playerAbility) {
          const scaledAbility = getScaledAbilityEffects(selectedAbility, playerAbility.rank);
          if (scaledAbility) {
            decision.pitcherAbility = {
              playerId: matchState.currentPitcher.id,
              abilityId: selectedAbility,
              effects: scaledAbility.effects,
              activatedAt: "pre_at_bat",
            };
          }
        }
      }
    }

    // Zone read: resolve pitch landing and compute zone modifier
    if (aimedZone) {
      const batter = matchState.currentBatter;
      const pitcher = matchState.currentPitcher;
      const zoneMap = deriveZoneMap(batter);

      let landing: ZoneCell;
      let batterSwing: ZoneCell | undefined;
      let pitcherAim: ZoneCell | undefined;
      if (isMyBatter) {
        // Batting: pitcher AI picks a target zone, then execution variance is applied
        // to *that aim*, producing where the pitch actually ends up.
        // The batter's prediction (aimedZone) is compared to this landing zone.
        //
        // AI priority:
        //   80% on-pattern — pitcher works within their archetype tendency zones,
        //     but prefers cold zones for this batter when available within tendency.
        //   20% off-pattern — either targeting a cold zone anywhere on the map
        //     (50% of wilds) or a truly random zone (50% of wilds).
        const tendencyZones = derivePitchTendency(pitcher);
        const coldTendencyZones = tendencyZones.filter(
          (z) => zoneMap[z.row][z.col] === "cold"
        );
        // Within tendency: prefer cold zones, fall back to full tendency set
        const onPatternPool = coldTendencyZones.length > 0 ? coldTendencyZones : tendencyZones;

        if (matchState.rng.random() < 0.8) {
          // On-pattern: archetype style with cold-zone preference
          pitcherAim = onPatternPool[Math.floor(matchState.rng.random() * onPatternPool.length)];
        } else {
          // Off-pattern: half the time go to any cold zone, half truly random
          const allColdZones: ZoneCell[] = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              if (zoneMap[r][c] === "cold") {
                allColdZones.push({ row: r as 0 | 1 | 2, col: c as 0 | 1 | 2 });
              }
            }
          }
          if (allColdZones.length > 0 && matchState.rng.random() < 0.5) {
            pitcherAim = allColdZones[Math.floor(matchState.rng.random() * allColdZones.length)];
          } else {
            pitcherAim = {
              row: Math.floor(matchState.rng.random() * 3) as 0 | 1 | 2,
              col: Math.floor(matchState.rng.random() * 3) as 0 | 1 | 2,
            };
          }
        }
        landing = resolvePitchLanding(pitcherAim, pitcher, matchState.rng);
        decision.zoneResult = calcBattingZoneModifier(aimedZone, landing, zoneMap);
      } else {
        // Pitching: player is the pitcher — their click is the aim zone.
        landing = resolvePitchLanding(aimedZone, pitcher, matchState.rng);

        // AI batter reads the pitch. Smart: looks in pitcher's tendency zones
        // (scouted the pitcher) biased toward their own hot zones, so throwing
        // off-pattern to cold zones consistently fools them.
        //   50% on-tendency — looking where this pitcher usually throws
        //   30% hot-zone look — protecting their strength regardless of pitcher
        //   20% random — unpredictable
        const tendencies = derivePitchTendency(pitcher);
        const hotTendencies = tendencies.filter((z) => zoneMap[z.row][z.col] === "hot");
        const allHotZones: ZoneCell[] = [];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (zoneMap[r][c] === "hot") {
              allHotZones.push({ row: r as 0 | 1 | 2, col: c as 0 | 1 | 2 });
            }
          }
        }
        const swingRoll = matchState.rng.random();
        let batterSwingZone: ZoneCell;
        if (swingRoll < 0.5) {
          // On-tendency: prefer hot overlap within tendency
          const pool = hotTendencies.length > 0 ? hotTendencies : tendencies;
          batterSwingZone = pool[Math.floor(matchState.rng.random() * pool.length)];
        } else if (swingRoll < 0.8 && allHotZones.length > 0) {
          batterSwingZone = allHotZones[Math.floor(matchState.rng.random() * allHotZones.length)];
        } else {
          batterSwingZone = {
            row: Math.floor(matchState.rng.random() * 3) as 0 | 1 | 2,
            col: Math.floor(matchState.rng.random() * 3) as 0 | 1 | 2,
          };
        }

        batterSwing = batterSwingZone;
        // AI batter's read drives the outcome — same modifier as player batting
        decision.zoneResult = calcBattingZoneModifier(batterSwingZone, landing, zoneMap);
      }

      // Capture for post-pitch result display
      setLastZonePlay({
        aimed: aimedZone,
        zoneMap,
        result: decision.zoneResult,
        isMyBatter,
        batterSwing,
      });

      // Store zone selections for visualization in result screen
      if (isMyBatter) {
        // Batting: pitcher aims, batter predicted aimedZone
        decision.pitcherAimedZone = pitcherAim; // AI pitcher's aim
        decision.batterAimedZone = aimedZone;   // Player's prediction
      } else {
        // Pitching: player aims the pitch, batter predicted
        decision.pitcherAimedZone = aimedZone;    // Player's aim
        decision.batterAimedZone = batterSwing;   // AI batter's swing zone
      }
    }

    const newState = simulateAtBat_Interactive(matchState, decision);
    setMatchState(newState);
    setSelectedAbility(null);

    // Update field marker from last play result
    if (newState.playByPlay.length > 0) {
      const lastEvent = newState.playByPlay[newState.playByPlay.length - 1];
      setLastRunsScored(lastEvent.rbi || 0);

      const positions = FIELD_POSITIONS[lastEvent.outcome];
      if (positions) {
        const pos = positions[Math.floor(Math.random() * positions.length)];
        setFieldMarker({ ...pos, type: lastEvent.outcome });
      } else if (TEXT_MARKERS[lastEvent.outcome]) {
        setFieldMarker({ x: 120, y: 175, type: lastEvent.outcome });
      } else {
        setFieldMarker(null);
      }
    }

    // Pause on high-leverage results: show the result and require explicit continue
    // before auto-sim resumes. This gives the player a moment to absorb what happened.
    const wasHighLeveragePlay = isHighLeverage(matchState);
    // Also pause when the player used the zone grid — result card replaces the old overlay
    const usedZoneGrid = !!aimedZone;
    if (newState.inningComplete || newState.isComplete || wasHighLeveragePlay || usedZoneGrid) {
      setShowingResult(true);
    }

    // Big moment overlay — home runs only (walk-off, grand slam, regular homer).
    // Other scoring plays are shown in the zone result card and play log;
    // too many interrupting overlays hurts flow more than it helps.
    if (newState.playByPlay.length > 0) {
      const ev = newState.playByPlay[newState.playByPlay.length - 1];
      const outcome = ev.outcome;
      const runsScored = ev.rbi ?? 0;
      const isMyTeamOffense = !ev.isTop;

      const epicMs   = autoSimulating ? 2200 : 3500;
      const legendMs = autoSimulating ? 2200 : 5000;

      if (isMyTeamOffense && outcome === "homerun") {
        const isWalkoff = newState.isComplete && newState.myRuns > newState.opponentRuns;
        if (isWalkoff) {
          setBigMoment({ tier: "legendary", headline: "WALK-OFF!", narrativeText: ev.narrativeText ?? "", durationMs: legendMs });
        } else if (runsScored >= 4) {
          setBigMoment({ tier: "legendary", headline: "GRAND SLAM!", narrativeText: ev.narrativeText ?? "", durationMs: legendMs });
        } else {
          setBigMoment({ tier: "epic", headline: "HOME RUN!", narrativeText: ev.narrativeText ?? "", durationMs: epicMs });
        }
      }
    }
  };

  const handleContinue = () => {
    setShowingResult(false);
    setLastRunsScored(0);
    setLastZonePlay(null); // zone result is embedded in result card; clear on dismiss
    if (matchState.inningComplete) {
      setMatchState((prev) => ({ ...prev, inningComplete: false }));
    }
  };

  const handleSelectGamePlan = (plan: BatterApproach) => {
    setInningGamePlan(plan);
    // Auto-advance effects will pick this up and start the game-plan auto-sim
  };

  // Show the game plan selector when player's team is about to bat and no plan is set
  const showGamePlanSelector =
    isMyBatter &&
    !inningGamePlan &&
    !autoSimulating &&
    !showingResult &&
    !matchState.inningComplete &&
    !matchState.isComplete;

  // True when auto-sim will fire on the next tick — prevents flashing the zone
  // grid for the brief window between a game plan being set and the timer firing.
  const pendingAutoSim =
    !autoSimulating &&
    !showingResult &&
    !matchState.inningComplete &&
    !matchState.isComplete &&
    (
      // My team batting: plan is set but it's not a clutch moment
      (!matchState.isTop && !!inningGamePlan && !isHighLeverage(matchState)) ||
      // Opponent batting: always auto-sims unless clutch
      (matchState.isTop && !isHighLeverage(matchState))
    );

  // True when we've paused auto-sim for a high-leverage at-bat
  const isClutch =
    !autoSimulating &&
    !showingResult &&
    !matchState.inningComplete &&
    !matchState.isComplete &&
    isHighLeverage(matchState);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    autoSimulating,
    showingResult,
    matchState,
    isMyBatter,
    selectedAbility,
    setSelectedAbility,
    activeAbilities,
    activePlayer,
    onSimulateAtBat: handleSimulateAtBat,
    onContinue: handleContinue,
    onComplete,
    matchRewards,
    fans,
    disableActionShortcuts: showGamePlanSelector,
  });

  // Final score screen (early return, after all hooks)
  if (matchState.isComplete && !showingResult) {
    const isWin = matchState.myRuns > matchState.opponentRuns;
    const lastEvent = matchState.playByPlay[matchState.playByPlay.length - 1];
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Card className="max-w-4xl mx-auto p-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">{isWin ? "Victory!" : "Defeat"}</h2>
            <p className="text-2xl">
              Final Score: {matchState.myRuns} - {matchState.opponentRuns}
            </p>
            {lastEvent?.narrativeText && (
              <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
                {lastEvent.narrativeText}
              </p>
            )}
            {postMatchInsights.length > 0 && (
              <PostMatchInsightCards
                insights={postMatchInsights}
                emphasized={!isWin}
                defaultExpanded={!isWin}
                onViewed={() => {
                  trackPostMatchInsight({
                    timestamp: Date.now(),
                    type: "viewed",
                    isLossContext: !isWin,
                  });
                }}
                onExpandedChange={(expanded) => {
                  trackPostMatchInsight({
                    timestamp: Date.now(),
                    type: expanded ? "expanded" : "collapsed",
                    isLossContext: !isWin,
                  });
                }}
              />
            )}
            <Button
              onClick={() => {
                if (!isWin) {
                  trackPostMatchInsight({
                    timestamp: Date.now(),
                    type: "post_loss_continue",
                    isLossContext: true,
                  });
                }
                onComplete(finalizeInteractiveMatch(matchState, matchRewards, fans));
              }}
            >
              Continue
              <kbd className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
                Space
              </kbd>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Plays for the current half-inning
  const lastEvent = matchState.playByPlay[matchState.playByPlay.length - 1];
  const halfInningPlays = lastEvent
    ? matchState.playByPlay.filter(
        (p) => p.inning === lastEvent.inning && p.isTop === lastEvent.isTop,
      )
    : [];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <MatchHeader
        matchState={matchState}
        selectedSimMode={selectedSimMode}
        setSelectedSimMode={setSelectedSimMode}
        autoSimulating={autoSimulating}
        onAutoSim={(mode) => handleAutoSim(mode, matchState)}
      />

      <div className="w-full max-w-350 mx-auto flex flex-col flex-1 min-h-0 p-4 gap-3">
        <div className="flex-1 min-h-0 grid grid-cols-[3fr_2fr] gap-3">
          {/* Left: Diamond + Play-by-Play */}
          <div className="flex flex-col gap-3 min-h-0">
            <DiamondField bases={matchState.bases} fieldMarker={fieldMarker} />
            <PlayByPlayLog
              halfInningPlays={halfInningPlays}
              inningComplete={matchState.inningComplete}
              inning={matchState.inning}
              isTop={matchState.isTop}
              playLogRef={playLogRef}
            />
          </div>

          {/* Right: Role banner + Matchup card + Action bar */}
          <div className="flex flex-col gap-0 min-h-0">
            {/* Role banner — prominent, always visible */}
            {(() => {
              const fatigueLevel: PitcherFatigueLevel = isMyBatter
                ? matchState.opponentPitcherFatigueLevel
                : matchState.myPitcherFatigueLevel;
              const isFresh = fatigueLevel === "fresh";
              const isTired = fatigueLevel === "tired";
              const isGassed = fatigueLevel === "gassed";
              const statusColor = isGassed
                ? "bg-red-500/20 dark:bg-red-500/10 border-red-500 dark:border-red-400"
                : isTired
                  ? "bg-yellow-500/15 dark:bg-yellow-500/10 border-yellow-500 dark:border-yellow-400"
                  : "bg-green-500/15 dark:bg-green-500/10 border-green-500 dark:border-green-400";
              const statusText = isGassed
                ? "text-red-600 dark:text-red-400"
                : isTired
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-green-600 dark:text-green-400";
              const statusLabel = isGassed
                ? isMyBatter ? "PITCHER GASSED" : "GASSED"
                : isTired
                  ? isMyBatter ? "PITCHER TIRED" : "TIRED"
                  : isMyBatter ? "PITCHER FRESH" : "FRESH";
              return (
                <div
                  className={`shrink-0 flex flex-col gap-2 px-4 py-3 border-b-2 ${isMyBatter ? "bg-blue-500/10 border-blue-500" : "bg-red-500/10 border-red-500"}`}
                >
                  {/* Role label + status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-base font-bold uppercase tracking-wider ${isMyBatter ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
                      {isMyBatter ? "⚾ At Bat" : "🔥 On the Mound"}
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded border ${statusColor} ${statusText}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Clutch indicator + fatigue detail */}
                  <div className="flex items-center gap-2 text-xs">
                    {isClutch && (
                      <span className="font-bold text-amber-500 dark:text-amber-400">⚡ CLUTCH MOMENT</span>
                    )}
                    {fatigueLevel !== "fresh" && (
                      <span className={`${isGassed ? "text-red-500 dark:text-red-400" : "text-orange-400 dark:text-orange-300"}`}>
                        {isGassed ? "Arm running out" : "Showing wear"}
                      </span>
                    )}
                    {inningGamePlan && isClutch && (
                      <span className="text-muted-foreground">— override or stick?</span>
                    )}
                  </div>
                </div>
              );
            })()}
            

            {/* Matchup card with margin below */}
            <div className="shrink-0 p-3">
              <MatchupCard
                matchState={matchState}
                isMyBatter={isMyBatter}
                myTeamColor={myTeamColor}
                opponentTeamColor={opponentTeamColor}
              />
            </div>

            {/* Margin/spacing divider */}
            <div className="h-2 shrink-0" />

            {/* Game plan selector or action bar */}
            <div
              className={`flex-1 min-h-0 flex flex-col transition-opacity duration-300 ${autoSimulating || pendingAutoSim ? "opacity-40" : ""}`}
            >
              <div className="flex-1 min-h-0 px-2 py-2 overflow-hidden">
                {!showGamePlanSelector && (
                  <ActionBar
                    key={`${matchState.currentBatter.id}-${matchState.currentPitcher.id}`}
                    matchState={matchState}
                    isMyBatter={isMyBatter}
                    autoSimulating={autoSimulating || pendingAutoSim}
                    simMode={simMode}
                    showingResult={showingResult}
                    selectedAbility={selectedAbility}
                    setSelectedAbility={setSelectedAbility}
                    currentBatterAbilities={currentBatterAbilities}
                    currentPitcherAbilities={currentPitcherAbilities}
                    selectedAbilityDef={selectedAbilityDef}
                    onSimulateAtBat={handleSimulateAtBat}
                    onContinue={handleContinue}
                    zoneMap={currentZoneMap}
                    pitchHint={currentPitchHint}
                    inningGamePlan={inningGamePlan}
                    zonePlay={lastZonePlay}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tactical plan selector — fixed bottom position, not overlaying */}
      {showGamePlanSelector && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
          <div className="w-full max-w-350 mx-auto">
            <TacticalPlanSelector
              inning={matchState.inning}
              myRuns={matchState.myRuns}
              opponentRuns={matchState.opponentRuns}
              pitcherFatigue={matchState.opponentPitcherFatigueLevel}
              onSelectPlan={handleSelectGamePlan}
            />
          </div>
        </div>
      )}

      {/* Zone result is embedded in ActionBar's result card — no separate overlay needed */}



      {bigMoment && (
        <BigMomentOverlay moment={bigMoment} onExited={() => setBigMoment(null)} />
      )}
    </div>
  );
}
