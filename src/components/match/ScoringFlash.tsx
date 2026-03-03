import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoringFlashData {
  playerName: string;
  outcome: string;
  rbi: number;
  isMyTeam: boolean;
}

interface ScoringFlashProps {
  flash: ScoringFlashData;
  onDismiss: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_MS    = 2400;
const FADE_IN_MS  = 160;
const FADE_OUT_MS = TOTAL_MS - 380;

const OUTCOME_ICONS: Record<string, string> = {
  homerun: "🏠",
  triple:  "🔺",
  double:  "⬆️",
  single:  "➡️",
  walk:    "🟡",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLabel(outcome: string, rbi: number): string {
  const hitName =
    outcome === "homerun" ? "HOMER"
    : outcome === "triple" ? "TRIPLE"
    : outcome === "double" ? "DOUBLE"
    : outcome === "single" ? "SINGLE"
    : outcome === "walk"   ? "WALK"
    : "PLAY";

  if (outcome === "homerun") {
    return rbi === 1 ? "SOLO HOMER" : `${rbi}-RUN HOMER`;
  }
  return rbi === 1 ? `RBI ${hitName}` : `${rbi}-RUN ${hitName}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Ephemeral scoring flash — fixed-positioned so it intentionally breaks out of
 * card boundaries. Auto-dismisses after ~2.4 s. No user interaction required.
 *
 * Appears in the left panel area (over the diamond/log divide) whenever any
 * run scores during play, whether player-driven or auto-simmed.
 */
export function ScoringFlash({ flash, onDismiss }: ScoringFlashProps) {
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">("entering");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"),  FADE_IN_MS);
    const t2 = setTimeout(() => setPhase("exiting"),  FADE_OUT_MS);
    const t3 = setTimeout(onDismiss,                   TOTAL_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDismiss]);

  const icon      = OUTCOME_ICONS[flash.outcome] ?? "💥";
  const label     = buildLabel(flash.outcome, flash.rbi);
  const runText   = flash.rbi === 1 ? "1 RUN" : `${flash.rbi} RUNS`;
  const isVisible = phase === "visible";

  // Slide in from left; gently recede on exit
  const transform =
    phase === "entering" ? "translateX(-28px) scale(0.86)"
    : phase === "exiting" ? "translateX(-10px) scale(0.96)"
    : "translateX(0) scale(1)";

  const transitionMs = phase === "entering" ? FADE_IN_MS : 350;

  // My team → amber accent; opponent → red accent
  const accentHex   = flash.isMyTeam ? "#f59e0b" : "#ef4444";
  const badgeClass  = flash.isMyTeam
    ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
    : "bg-red-500/25 text-red-300 border border-red-500/40";

  return (
    <div
      className="fixed z-30 pointer-events-none select-none"
      // 38% from top sits between diamond & play log; 4% from left breaks the card edge
      style={{ top: "38%", left: "4%" }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-md bg-black/85 border shadow-2xl"
        style={{
          borderLeftWidth: "3px",
          borderLeftColor: accentHex,
          borderColor: `${accentHex}35`,
          opacity:    isVisible ? 1 : 0,
          transform,
          transition: `opacity ${transitionMs}ms ease, transform ${transitionMs}ms ease`,
          minWidth:  "210px",
          maxWidth:  "310px",
          boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${accentHex}20`,
        }}
      >
        {/* Icon */}
        <span className="text-2xl leading-none shrink-0">{icon}</span>

        {/* Name + label */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-bold text-white leading-tight truncate">
            {flash.playerName}
          </span>
          <span className="text-[11px] text-white/60 uppercase tracking-widest leading-tight mt-px">
            {label}
          </span>
        </div>

        {/* Run count badge */}
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${badgeClass}`}>
          +{runText}
        </span>
      </div>
    </div>
  );
}
