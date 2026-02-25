import { useEffect } from "react";
import { BATTER_APPROACHES } from "@/engine/approachConfig";
import type { BatterApproach } from "@/types/approach";

interface InningGamePlanSelectorProps {
  inning: number;
  myRuns: number;
  opponentRuns: number;
  onSelectPlan: (plan: BatterApproach) => void;
}

const PLAN_ORDER: BatterApproach[] = ["contact", "power", "patient"];
const SHORTCUT_KEYS = ["1", "2", "3"];

export function InningGamePlanSelector({
  inning,
  myRuns,
  opponentRuns,
  onSelectPlan,
}: InningGamePlanSelectorProps) {
  const scoreDiff = myRuns - opponentRuns;
  const scoreLabel =
    scoreDiff === 0
      ? "Tied"
      : scoreDiff > 0
        ? `Up ${scoreDiff}`
        : `Down ${Math.abs(scoreDiff)}`;

  // Keyboard shortcuts: 1 / 2 / 3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = SHORTCUT_KEYS.indexOf(e.key);
      if (idx !== -1) {
        onSelectPlan(PLAN_ORDER[idx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectPlan]);

  return (
    <div className="h-full flex flex-col justify-center gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Set your game plan
        </span>
        <span className="text-xs text-muted-foreground">
          Bottom {inning} · {scoreLabel} {myRuns}–{opponentRuns}
        </span>
      </div>

      <div className="flex gap-2">
        {PLAN_ORDER.map((planId, i) => {
          const approach = BATTER_APPROACHES[planId];
          return (
            <button
              key={planId}
              onClick={() => onSelectPlan(planId)}
              className="flex-1 h-auto border border-border rounded bg-card hover:bg-accent transition-colors px-3 py-2 text-left flex flex-col gap-0.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-base leading-none">{approach.icon}</span>
                <kbd className="text-[9px] font-mono opacity-40 bg-black/10 dark:bg-white/10 rounded px-1 py-px group-hover:opacity-70">
                  {SHORTCUT_KEYS[i]}
                </kbd>
              </div>
              <span className="font-bold text-xs text-foreground">{approach.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {approach.shortDescription}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug">
        Routine at-bats will auto-play using this plan. You'll be asked to decide in clutch situations.
      </p>
    </div>
  );
}
