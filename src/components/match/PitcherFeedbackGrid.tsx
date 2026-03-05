/**
 * PitcherFeedbackGrid — Shows pitch result resolution while keeping the zone grid visible
 *
 * Flow:
 * 1. Pitcher selects zone (grid is interactive)
 * 2. Zone grid becomes static, overlays show:
 *    - Where batter expected (their pick)
 *    - Where pitch actually landed (server result)
 *    - Outcome (hit/miss/contact)
 * 3. User dismisses → next batter
 */

import { useEffect, useState } from "react";
import type { ZoneCell, ZoneMap } from "@/engine/zoneSystem";
import { ZoneGrid } from "./ZoneGrid";

interface PitcherFeedbackGridProps {
  /** The zone map (batter's perspective of dangers) */
  zoneMap: ZoneMap;
  /** Where the pitcher aimed */
  pitcherChoice: ZoneCell;
  /** Where the batter was expecting (their anticipation) */
  batterExpected: ZoneCell;
  /** Where the pitch actually landed (execution) */
  pitchLanded: ZoneCell;
  /** Outcome text to display (e.g., "Hit!", "Strikeout", "Ball") */
  outcome: string;
  /** Whether this was a perfect result (painted corner, perfect contact) */
  isPerfect?: boolean;
  /** Called when user dismisses (click or space) */
  onDismiss: () => void;
}

/**
 * Visual indicator for a zone cell choice
 */
function ZoneCellIndicator({
  cell,
  label,
  color,
  icon,
}: {
  cell: ZoneCell;
  label: string;
  color: string;
  icon: string;
}) {
  // Position of cell on a 3x3 grid (using percentage)
  const top = `${cell.row * 33.33}%`;
  const left = `${cell.col * 33.33}%`;

  return (
    <div
      className={`absolute w-1/3 h-1/3 flex items-center justify-center pointer-events-none`}
      style={{ top, left }}
    >
      <div
        className={`flex flex-col items-center gap-0.5 text-center px-1 py-0.5 rounded backdrop-blur-sm ${color}`}
      >
        <div className="text-xl">{icon}</div>
        <div className="text-[10px] font-bold leading-none whitespace-nowrap">{label}</div>
      </div>
    </div>
  );
}

export function PitcherFeedbackGrid({
  zoneMap,
  pitcherChoice,
  batterExpected,
  pitchLanded,
  outcome,
  isPerfect,
  onDismiss,
}: PitcherFeedbackGridProps) {
  const [showFeedback, setShowFeedback] = useState(false);

  // Auto-show feedback after a tiny delay for animation
  useEffect(() => {
    const timer = setTimeout(() => setShowFeedback(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Space or click to dismiss
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        onDismiss();
      }
    }
    function onClick() {
      onDismiss();
    }

    if (showFeedback) {
      window.addEventListener("keydown", onKey);
      window.addEventListener("click", onClick);
      return () => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("click", onClick);
      };
    }
  }, [showFeedback, onDismiss]);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-4">
      {/* Zone grid — static, showing all overlays */}
      <div className="relative w-48 h-48 bg-gradient-to-b from-slate-900 to-slate-950 rounded border border-slate-700/50 shadow-lg">
        {/* Grid background */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0.5 p-0.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-800/50 rounded border border-slate-700/30"
            />
          ))}
        </div>

        {/* Pitcher choice — what was actually thrown */}
        {showFeedback && (
          <ZoneCellIndicator
            cell={pitcherChoice}
            label="Thrown"
            icon="🎯"
            color="bg-cyan-500/70 text-cyan-100 border border-cyan-400/50"
          />
        )}

        {/* Batter expected — their anticipation */}
        {showFeedback && (
          <ZoneCellIndicator
            cell={batterExpected}
            label="Expected"
            icon="👀"
            color="bg-amber-500/70 text-amber-100 border border-amber-400/50"
          />
        )}

        {/* Pitch landed — execution result (may differ from aim) */}
        {showFeedback && pitchLanded !== pitcherChoice && (
          <ZoneCellIndicator
            cell={pitchLanded}
            label="Landed"
            icon="⚡"
            color="bg-purple-500/70 text-purple-100 border border-purple-400/50"
          />
        )}
      </div>

      {/* Outcome text */}
      {showFeedback && (
        <div className="text-center animate-in fade-in duration-300">
          <div className="text-2xl font-bold text-white mb-1">{outcome}</div>
          {isPerfect && (
            <div className="text-xs text-amber-400 font-semibold animate-pulse">
              ✨ Perfect execution
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {showFeedback && (
        <div className="text-xs text-muted-foreground mt-2 animate-in fade-in duration-500">
          Click anywhere or press{" "}
          <kbd className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 font-mono">
            Space
          </kbd>{" "}
          to continue
        </div>
      )}
    </div>
  );
}
