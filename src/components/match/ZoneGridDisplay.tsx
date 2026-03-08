/**
 * ZoneGridDisplay — unified zone grid for both selection and result reveal.
 *
 * In selection mode (resultData=null): shows pick-your-spot grid with zone hints and shortcuts
 * In reveal mode (resultData set): same grid, same size/position, icons fade in to show outcome
 *
 * Keeps the grid stable across the transition — no jarring size jump.
 */

import type { ZoneCell, ZoneMap } from "@/engine/zoneSystem";

const ROW_LABELS = ["HI", "MID", "LO"] as const;
const COL_LABELS = ["IN", "MID", "OUT"] as const;

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

// ─── Result reveal helpers ────────────────────────────────────────────────────

function getCellPhysics(row: number, col: number): string {
  const CELL_PHYSICS_LABELS: string[][] = [
    ["jam or bomb", "power zone", "chase zone"],  // HI
    ["pull power",  "meatball",   "contact zone"], // MID
    ["grounder in", "groundball", "walk zone"],    // LO
  ];
  return CELL_PHYSICS_LABELS[row][col];
}

function getResultMetaForCell(
  mode: "batting" | "pitching",
  zoneType: "hot" | "neutral" | "cold",
): string {
  if (mode === "batting") {
    if (zoneType === "hot") return "⭐";
    if (zoneType === "cold") return "❄️";
    return "";
  }
  // pitching
  if (zoneType === "hot") return "🔥";
  if (zoneType === "cold") return "🎯";
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ZoneGridDisplayProps {
  mode: "batting" | "pitching";
  zoneMap: ZoneMap;
  pitchHint?: ZoneCell[];
  onSelect?: (cell: ZoneCell) => void;
  disabled?: boolean;
  fillHeight?: boolean;

  /** Result reveal: show where pitch landed and what was aimed */
  resultData?: {
    aimed: ZoneCell;
    batterSwing?: ZoneCell;
    landingZone: ZoneCell;
    isPerfect: boolean;
  };
}

export function ZoneGridDisplay({
  mode,
  zoneMap,
  pitchHint,
  onSelect,
  disabled = false,
  fillHeight = false,
  resultData,
}: ZoneGridDisplayProps) {
  const isResultMode = !!resultData;

  const fh = fillHeight;

  return (
    <div className={fh ? "select-none w-full h-full flex flex-col" : "select-none w-full"}>
      {/* Mode label / result mode header */}
      {isResultMode ? (
        <div className={`mb-1.5 shrink-0`}>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>⚾ pitch location</span>
            {resultData?.batterSwing && (
              <span>👀 {mode === "batting" ? "your read" : "batter expected"}</span>
            )}
            {resultData?.isPerfect && <span className="text-amber-400">✨ perfect execution</span>}
          </div>
        </div>
      ) : (
        <div className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5${fh ? " shrink-0" : ""}`}>
          {mode === "batting" ? "Pick your spot" : "Where to throw"}
        </div>
      )}

      {/* Context legend (selection mode only) */}
      {!isResultMode && (
        <div className={`flex gap-2 mb-1.5 text-[11px] text-muted-foreground leading-tight flex-wrap${fh ? " shrink-0" : ""}`}>
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
      )}

      <div className={fh ? "flex gap-2 flex-1 min-h-0" : "flex gap-2"}>
        {/* Row labels */}
        <div className={fh ? "flex flex-col" : "flex flex-col justify-around"}>
          {ROW_LABELS.map((label) => (
            <div
              key={label}
              className={`text-xs text-muted-foreground font-bold w-8 text-right leading-none flex items-center justify-end pr-1${fh ? " flex-1" : " h-14"}`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className={fh ? "flex flex-col gap-1.5 flex-1 min-h-0" : "flex flex-col gap-1.5 flex-1"}>
          {/* Column labels */}
          <div className={`flex gap-1.5 mb-0.5 px-0.5${fh ? " shrink-0" : ""}`}>
            {COL_LABELS.map((label) => (
              <div key={label} className="flex-1 text-center text-xs text-muted-foreground font-bold">
                {label}
              </div>
            ))}
          </div>

          {/* Zone cells */}
          {[0, 1, 2].map((row) => (
            <div key={row} className={fh ? "flex gap-1.5 flex-1 min-h-0" : "flex gap-1.5"}>
              {[0, 1, 2].map((col) => {
                const zoneType = zoneMap[row][col];
                const hint = isHintCell(
                  { row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 },
                  pitchHint,
                );
                const shortcut = SHORTCUTS[row][col];

                const isLanding =
                  isResultMode &&
                  resultData?.landingZone.row === row &&
                  resultData?.landingZone.col === col;
                const isBatterSwing =
                  isResultMode &&
                  resultData?.batterSwing?.row === row &&
                  resultData?.batterSwing?.col === col;

                return (
                  <ResultCell
                    key={cellKey({ row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 })}
                    row={row as 0 | 1 | 2}
                    col={col as 0 | 1 | 2}
                    zoneType={zoneType}
                    isHint={hint}
                    shortcut={shortcut}
                    mode={mode}
                    disabled={disabled || isResultMode}
                    fillHeight={fh}
                    onClick={() => !disabled && !isResultMode && onSelect?.({ row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 })}
                    // Result mode props
                    isResultMode={isResultMode}
                    isLanding={isLanding}
                    isBatterSwing={isBatterSwing}
                    isPerfect={isLanding && resultData?.isPerfect}
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

// ─── Result Cell Component ────────────────────────────────────────────────────

interface ResultCellProps {
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
  zoneType: "hot" | "neutral" | "cold";
  isHint: boolean;
  shortcut: string;
  mode: "batting" | "pitching";
  disabled: boolean;
  fillHeight: boolean;
  onClick: () => void;
  isResultMode: boolean;
  isLanding?: boolean;
  isBatterSwing?: boolean;
  isPerfect?: boolean;
}

function ResultCell({
  row,
  col,
  zoneType,
  isHint,
  shortcut,
  mode,
  disabled,
  fillHeight,
  onClick,
  isResultMode,
  isLanding,
  isBatterSwing,
  isPerfect,
}: ResultCellProps) {
  // Background coloring — batter expectation zone gets a warm tint
  const bgClass = (() => {
    if (isResultMode && isBatterSwing && !isLanding) {
      return "bg-amber-500/20 border-amber-400/50"; // Where batter was looking
    }
    if (zoneType === "hot") {
      const base = mode === "pitching"
        ? "bg-red-500/50 border-red-500/80"
        : "bg-amber-500/50 border-amber-500/80";
      return isHint ? `${base} ring-1 ring-yellow-400/60` : base;
    }
    if (zoneType === "cold") {
      const base = mode === "pitching"
        ? "bg-cyan-500/40 border-cyan-400/70"
        : "bg-violet-500/40 border-violet-400/70";
      return isHint ? `${base} ring-1 ring-yellow-400/60` : base;
    }
    return isHint
      ? "bg-yellow-400/20 border-yellow-400/60"
      : "bg-card border-border";
  })();

  // Zone type icon (visible in selection mode as background hint)
  const typeIcon = (() => {
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
        flex-1 rounded border flex flex-col items-center justify-center
        gap-0.5 transition-all duration-100 relative group
        ${fillHeight ? "min-h-10 self-stretch" : "h-14"}
        ${bgClass}
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 hover:border-foreground/40 cursor-pointer active:scale-95"}
      `}
    >
      {/* Result mode: pitch location + batter expectation */}
      {isResultMode ? (
        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
          {isLanding && (
            <div className={`text-lg leading-none animate-in fade-in-0 zoom-in-75 duration-300${isPerfect ? " drop-shadow-lg" : ""}`}>
              ⚾
            </div>
          )}
          {isBatterSwing && (
            <div className="text-xs leading-none opacity-70 animate-in fade-in-0 duration-500">
              👀
            </div>
          )}
          {!isLanding && !isBatterSwing && typeIcon && (
            <div className="text-xs leading-none opacity-20">{typeIcon}</div>
          )}
        </div>
      ) : (
        <>
          {/* Selection mode: zone type icon + shortcut */}
          {typeIcon && !isHint && (
            <span className={`text-base leading-none${isHint && zoneType === "neutral" ? " opacity-50" : ""}`}>
              {typeIcon}
            </span>
          )}
          {isHint && zoneType === "neutral" && (
            <span className="text-base leading-none opacity-50">⚾</span>
          )}
          <kbd className="text-[11px] font-mono opacity-60 leading-none">{shortcut}</kbd>
        </>
      )}
    </button>
  );
}
