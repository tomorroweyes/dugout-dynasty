/**
 * ZoneGrid — 3×3 pitch zone selection minigame UI
 *
 * Batting mode: shows batter's hot/cold zones + pitch tendency hints.
 *   Player picks where they think the pitch will go.
 *
 * Pitching mode: shows batter's hot/cold zones as danger/target map.
 *   Player picks where to throw (execution variance resolved in engine).
 *
 * Row 0 = High, Row 1 = Mid, Row 2 = Low
 * Col 0 = Inside, Col 1 = Middle, Col 2 = Outside
 *
 * Keyboard shortcuts: numpad layout
 *   7 8 9  →  top row (high)
 *   4 5 6  →  mid row
 *   1 2 3  →  bottom row (low)
 */

import { useEffect } from "react";
import type { ZoneCell, ZoneMap } from "@/engine/zoneSystem";

interface ZoneGridProps {
  mode: "batting" | "pitching";
  zoneMap: ZoneMap;
  pitchHint?: ZoneCell[]; // batting only — cells shown as hint
  onSelect: (cell: ZoneCell) => void;
  disabled?: boolean;
}

const ROW_LABELS = ["HI", "MID", "LO"];
const COL_LABELS = ["IN", "MID", "OUT"];

// numpad layout: row 0 = keys 7,8,9; row 1 = 4,5,6; row 2 = 1,2,3
const SHORTCUTS: string[][] = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
];

function cellKey(cell: ZoneCell): string {
  return `${cell.row}-${cell.col}`;
}

function isHintCell(cell: ZoneCell, hints?: ZoneCell[]): boolean {
  return hints?.some((h) => h.row === cell.row && h.col === cell.col) ?? false;
}

function isCellCorner(row: number, col: number): boolean {
  return (row === 0 || row === 2) && (col === 0 || col === 2);
}

// Short physics descriptor per cell — matches ZONE_PHYSICS in zoneSystem.ts
const CELL_PHYSICS_LABELS: string[][] = [
  ["jam or bomb", "power zone", "chase zone"],  // HI
  ["pull power",  "meatball",   "contact zone"], // MID
  ["grounder in", "groundball", "walk zone"],    // LO
];

/**
 * Short label shown on hover so players understand the value of each zone
 * before committing. Combines hot/cold read bonus context with zone physics.
 */
function computePreviewLabel(
  mode: "batting" | "pitching",
  zoneType: "hot" | "neutral" | "cold",
  isHint: boolean,
  row: number,
  col: number
): string {
  const physics = CELL_PHYSICS_LABELS[row][col];
  if (mode === "batting") {
    if (zoneType === "hot") return `⭐ nat 20 if correct · ${physics}`;
    if (zoneType === "cold") return `⚠ weak spot · ${physics}`;
    if (isHint) return `pitcher targets here · ${physics}`;
    return physics;
  }
  // pitching
  if (zoneType === "hot") return `⚠ Danger! · ${physics}`;
  if (zoneType === "cold") {
    return isCellCorner(row, col) ? `⭐ Corner! · ${physics}` : `Cold zone · ${physics}`;
  }
  return physics;
}

export function ZoneGrid({ mode, zoneMap, pitchHint, onSelect, disabled }: ZoneGridProps) {
  // Keyboard shortcuts
  useEffect(() => {
    if (disabled) return;
    function onKey(e: KeyboardEvent) {
      const key = e.key;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (key === SHORTCUTS[row][col]) {
            e.preventDefault();
            onSelect({ row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 });
            return;
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onSelect]);

  return (
    <div className="select-none w-full">
      {/* Mode label */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {mode === "batting" ? "Pick your spot" : "Where to throw"}
      </div>

      {/* Context legend — explains what hot/cold mean in this mode */}
      <div className="flex gap-2 mb-1.5 text-[11px] text-muted-foreground leading-tight flex-wrap">
        {mode === "batting" ? (
          <>
            <span>🔥 your power zone</span>
            <span>❄️ your weak spot</span>
            <span className="text-yellow-500">⚾ pitcher tends here</span>
          </>
        ) : (
          <>
            <span>🔥 danger — avoid</span>
            <span>🎯 weakness — target</span>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {/* Row labels */}
        <div className="flex flex-col justify-around">
          {ROW_LABELS.map((label) => (
            <div
              key={label}
              className="text-xs text-muted-foreground font-mono w-7 text-right leading-none h-14 flex items-center justify-end pr-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex flex-col gap-1.5 flex-1">
          {/* Column labels */}
          <div className="flex gap-1.5 mb-0.5">
            {COL_LABELS.map((label) => (
              <div
                key={label}
                className="flex-1 text-center text-xs text-muted-foreground font-mono"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Zone cells */}
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex gap-1.5">
              {[0, 1, 2].map((col) => {
                const zoneType = zoneMap[row][col];
                const hint = isHintCell(
                  { row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 },
                  pitchHint
                );
                const shortcut = SHORTCUTS[row][col];
                const previewLabel = computePreviewLabel(mode, zoneType, hint, row, col);

                return (
                  <ZoneCell
                    key={cellKey({ row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 })}
                    zoneType={zoneType}
                    isHint={hint}
                    shortcut={shortcut}
                    mode={mode}
                    disabled={disabled}
                    previewLabel={previewLabel}
                    onClick={() =>
                      !disabled &&
                      onSelect({ row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 })
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Individual Zone Cell ─────────────────────────────────────────────────────

interface ZoneCellProps {
  zoneType: "hot" | "neutral" | "cold";
  isHint: boolean;
  shortcut: string;
  mode: "batting" | "pitching";
  disabled?: boolean;
  previewLabel: string;
  onClick: () => void;
}

function ZoneCell({ zoneType, isHint, shortcut, mode, disabled, previewLabel, onClick }: ZoneCellProps) {
  // Background and border classes — hint cells get a yellow ring on top of zone coloring.
  // Neutral hint cells get a yellow fill since they'd otherwise be invisible.
  const bgClass = (() => {
    if (zoneType === "hot") {
      const base = mode === "pitching"
        ? "bg-red-500/50 border-red-500/80"
        : "bg-amber-500/50 border-amber-500/80";
      return isHint ? `${base} ring-1 ring-yellow-400/60` : base;
    }
    if (zoneType === "cold") {
      // Pitching cold zones are targets — use cyan/teal instead of violet
      const base = mode === "pitching"
        ? "bg-cyan-500/40 border-cyan-400/70"
        : "bg-violet-500/40 border-violet-400/70";
      return isHint ? `${base} ring-1 ring-yellow-400/60` : base;
    }
    // Neutral zone — hint cells get a yellow fill so they stand out
    return isHint
      ? "bg-yellow-400/20 border-yellow-400/60"
      : "bg-card border-border";
  })();

  // Icon: pitching cold zones show a target reticle.
  // Neutral hint cells show a dimmed ball to suggest "pitcher aims here".
  const icon = (() => {
    if (zoneType === "hot") return "🔥";
    if (zoneType === "cold") return mode === "pitching" ? "🎯" : "❄️";
    if (isHint) return "⚾";
    return "";
  })();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 h-14 rounded border flex flex-col items-center justify-center
        gap-0.5 transition-all duration-100 relative group
        ${bgClass}
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 hover:border-foreground/40 cursor-pointer active:scale-95"}
      `}
    >
      {icon && (
        <span className={`text-base leading-none${isHint && zoneType === "neutral" ? " opacity-50" : ""}`}>
          {icon}
        </span>
      )}
      <kbd className="text-[11px] font-mono opacity-60 leading-none">{shortcut}</kbd>

      {/* Hover preview — shows zone value before committing */}
      {previewLabel && !disabled && (
        <div className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded bg-black/50 text-[8px] font-semibold text-white leading-tight text-center px-1 pointer-events-none">
          {previewLabel}
        </div>
      )}
    </button>
  );
}
