/**
 * ZoneMiniGrid — static display of a resolved zone play.
 * Used inside the result card so the player can study what happened
 * at their own pace, rather than a fleeting auto-dismissed overlay.
 *
 * Shows: pitch landing, player aim, optional batter swing, hot/cold bg.
 * No timers, no hover state, no dismiss handling.
 */

import type { ReactNode } from "react";
import type { ZoneCell, ZoneMap, ZoneModifier } from "@/engine/zoneSystem";

const ROW_LABELS = ["HI", "MID", "LO"] as const;
const COL_LABELS = ["IN", "MID", "OUT"] as const;

function getResultMeta(
  result: ZoneModifier,
  isMyBatter: boolean,
  aimed: ZoneCell,
): { headline: string; color: string; detail: string } {
  const landing = result.landingZone;

  const physicsNotes: Record<string, string> = {
    "0-0": "jam zone", "0-2": "chase zone", "1-1": "meatball",
    "2-0": "grounder", "2-2": "walk zone",
  };
  const physics = physicsNotes[`${landing.row}-${landing.col}`];
  const physicsTag = physics ? ` · ${physics}` : "";

  if (result.isPerfect) {
    return isMyBatter
      ? { headline: "⭐ Perfect Read!", color: "text-amber-400", detail: `+${result.hitBonus} hit · +${result.homerunBonus} HR${physicsTag}` }
      : { headline: "⚡ They Read You!", color: "text-red-400",   detail: `+${result.hitBonus} hit risk · +${result.homerunBonus} HR risk${physicsTag}` };
  }

  if (isMyBatter) {
    return result.hitBonus > 0
      ? { headline: "✓ Good Zone Read", color: "text-green-400",       detail: `+${result.hitBonus} hit bonus${physicsTag}` }
      : { headline: "✗ Wrong Zone",     color: "text-red-400",         detail: `${result.hitBonus} hit · +${result.strikeoutBonus} K risk${physicsTag}` };
  }

  if (result.hitBonus > 0)       return { headline: "⚠ They Read It",  color: "text-orange-400",      detail: `+${result.hitBonus} hit risk${physicsTag}` };
  if (result.strikeoutBonus > 0) return { headline: "✓ Fooled 'Em!",   color: "text-green-400",       detail: `+${result.strikeoutBonus} K bonus · wrong zone${physicsTag}` };

  const hitTarget = aimed.row === landing.row && aimed.col === landing.col;
  return hitTarget
    ? { headline: "✓ Hit the Spot",  color: "text-muted-foreground", detail: `neutral read${physicsTag}` }
    : { headline: "Neutral Zone",    color: "text-muted-foreground", detail: `no zone bonus${physicsTag}` };
}

interface ZoneMiniGridProps {
  aimed: ZoneCell;
  zoneMap: ZoneMap;
  result: ZoneModifier;
  isMyBatter: boolean;
  batterSwing?: ZoneCell;
}

export function ZoneMiniGrid({ aimed, zoneMap, result, isMyBatter, batterSwing }: ZoneMiniGridProps) {
  const landing = result.landingZone;
  const controlMissed = !isMyBatter && (aimed.row !== landing.row || aimed.col !== landing.col);
  const { headline, color, detail } = getResultMeta(result, isMyBatter, aimed);

  return (
    <div className="rounded-lg border border-border bg-card/60 px-2.5 py-2 space-y-2">
      {/* Headline + detail */}
      <div>
        <div className={`text-xs font-bold ${color}`}>{headline}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>

      {/* Mini 3×3 grid */}
      <div className="flex gap-1.5">
        {/* Row labels */}
        <div className="flex flex-col justify-around shrink-0">
          {ROW_LABELS.map((lbl) => (
            <div key={lbl} className="text-[10px] text-muted-foreground font-mono w-5 text-right h-8 flex items-center justify-end">
              {lbl}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {/* Col labels */}
          <div className="flex gap-1">
            {COL_LABELS.map((lbl) => (
              <div key={lbl} className="flex-1 text-center text-[10px] text-muted-foreground font-mono">
                {lbl}
              </div>
            ))}
          </div>

          {/* Cells */}
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex gap-1">
              {[0, 1, 2].map((col) => {
                const zt = zoneMap[row][col];
                const isLand  = landing.row === row && landing.col === col;
                const isAim   = aimed.row === row && aimed.col === col;
                const isSwing = batterSwing?.row === row && batterSwing?.col === col;

                const bg =
                  zt === "hot"
                    ? isMyBatter
                      ? "bg-amber-500/25 border-amber-500/50"
                      : "bg-red-500/25 border-red-500/50"
                    : zt === "cold"
                      ? "bg-violet-500/20 border-violet-400/50"
                      : "bg-card/80 border-border";

                const ring = result.isPerfect && isLand ? "ring-1 ring-amber-400/60" : "";

                return (
                  <div
                    key={`${row}-${col}`}
                    className={`flex-1 h-8 rounded border flex items-center justify-center ${bg} ${ring}`}
                  >
                    {(() => {
                      const icons: ReactNode[] = [];
                      if (isMyBatter) {
                        // batting: aimed=swing 🏏, land=pitch ⚾
                        if (isLand && isAim) return <div className="flex gap-px"><span className="text-xs">🏏</span><span className="text-xs">⚾</span></div>;
                        if (isLand) return <span className="text-xs">⚾</span>;
                        if (isAim) return <span className="text-xs opacity-50">🏏</span>;
                      } else {
                        // pitching: aimed=target 🎯, land=pitch ⚾, swing=batter 🏏
                        if (isAim && !isLand) icons.push(<span key="a" className="text-xs opacity-50">🎯</span>);
                        if (isLand) icons.push(<span key="l" className="text-xs">⚾</span>);
                        if (isAim && isLand) icons.unshift(<span key="a2" className="text-xs opacity-50">🎯</span>);
                        if (isSwing) icons.push(<span key="s" className="text-xs opacity-70">🏏</span>);
                        if (icons.length > 0) return <div className="flex gap-px">{icons}</div>;
                      }
                      return null;
                    })()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <span>⚾ pitch</span>
        {isMyBatter ? <span>🏏 swing</span> : <><span>🎯 aim</span>{batterSwing && <span>🏏 their read</span>}</>}
        {controlMissed && <span className="text-amber-500">· control miss</span>}
      </div>
    </div>
  );
}
