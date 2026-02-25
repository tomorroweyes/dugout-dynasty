/**
 * ZoneResultOverlay — post-pitch zone minigame result card.
 *
 * Shows as a fixed overlay in the bottom-right corner after a zone selection
 * resolves. Displays:
 *   ⚾  where the pitch actually landed
 *   🏏  where the batter swung (batting mode)
 *   🎯  where the pitcher aimed (pitching mode, when it missed the spot)
 *   hot/cold zone backgrounds for context
 *   result headline + mechanical bonus text
 *
 * Auto-dismisses after DURATION_MS; clickable to close early.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ZoneCell, ZoneMap, ZoneModifier } from "@/engine/zoneSystem";

interface ZoneResultOverlayProps {
  aimed: ZoneCell;
  zoneMap: ZoneMap;
  result: ZoneModifier;
  isMyBatter: boolean;
  batterSwing?: ZoneCell;
  onDismiss: () => void;
}

const ROW_LABELS = ["HI", "MID", "LO"] as const;
const COL_LABELS = ["IN", "MID", "OUT"] as const;

const DURATION_MS = 3500;

// Short physics note for significant landing zones
function getPhysicsNote(landing: ZoneCell): string | null {
  if (landing.row === 0 && landing.col === 0) return "jam zone";
  if (landing.row === 0) return "high zone · ↑HR potential";
  if (landing.row === 2 && landing.col === 2) return "walk zone";
  if (landing.row === 2) return "low zone · groundball";
  if (landing.col === 2) return "outside · walk tendency";
  if (landing.col === 1 && landing.row === 1) return "meatball zone";
  return null;
}

function getResultMeta(result: ZoneModifier, isMyBatter: boolean, aimed: ZoneCell) {
  const physics = getPhysicsNote(result.landingZone);
  const physicsTag = physics ? ` · ${physics}` : "";

  if (result.isPerfect) {
    return isMyBatter
      ? {
          headline: "⭐ Perfect Read!",
          color: "text-amber-400",
          detail: `+${result.hitBonus} hit · +${result.homerunBonus} HR${physicsTag}`,
        }
      : {
          headline: "⚡ They Read You!",
          color: "text-red-400",
          detail: `+${result.hitBonus} hit risk · +${result.homerunBonus} HR risk${physicsTag}`,
        };
  }

  if (isMyBatter) {
    return result.hitBonus > 0
      ? {
          headline: "✓ Good Read",
          color: "text-green-400",
          detail: `+${result.hitBonus} hit bonus${physicsTag}`,
        }
      : {
          headline: "✗ Wrong Zone",
          color: "text-red-400",
          detail: `${result.hitBonus} hit · +${result.strikeoutBonus} K risk${physicsTag}`,
        };
  }

  // pitching — AI batter's read drives the result
  if (result.hitBonus > 0) {
    return {
      headline: "⚠ They Read It",
      color: "text-orange-400",
      detail: `+${result.hitBonus} hit risk${physicsTag}`,
    };
  }
  if (result.strikeoutBonus > 0) {
    return {
      headline: "✓ Fooled 'Em!",
      color: "text-green-400",
      detail: `+${result.strikeoutBonus} K bonus · wrong zone${physicsTag}`,
    };
  }
  // Neutral — AI read correctly but to a cold zone (no bonuses either way)
  const hitTarget =
    aimed.row === result.landingZone.row && aimed.col === result.landingZone.col;
  return hitTarget
    ? {
        headline: "✓ Hit the Spot",
        color: "text-muted-foreground",
        detail: `neutral read${physicsTag} — mix in off-pattern throws to fool them`,
      }
    : {
        headline: "Neutral Zone",
        color: "text-muted-foreground",
        detail: `no zone bonus${physicsTag} — mix in off-pattern throws to fool them`,
      };
}

export function ZoneResultOverlay({
  aimed,
  zoneMap,
  result,
  isMyBatter,
  batterSwing,
  onDismiss,
}: ZoneResultOverlayProps) {
  const [visible, setVisible] = useState(false);
  const landing = result.landingZone;
  const controlMissed = !isMyBatter && (aimed.row !== landing.row || aimed.col !== landing.col);

  // Refs for the auto-dismiss timers so we can pause/resume on hover
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleExit = useCallback((delay: number) => {
    fadeTimerRef.current = setTimeout(() => setVisible(false), delay - 300);
    exitTimerRef.current = setTimeout(onDismiss, delay);
  }, [onDismiss]);

  const cancelExit = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  // Animate in, then schedule the initial auto-dismiss
  useEffect(() => {
    const t0 = setTimeout(() => setVisible(true), 10);
    scheduleExit(DURATION_MS);
    return () => {
      clearTimeout(t0);
      cancelExit();
    };
  }, [scheduleExit, cancelExit]);

  const { headline, color, detail } = getResultMeta(result, isMyBatter, aimed);

  return (
    <div
      className={`fixed bottom-4 right-4 z-30 w-64 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl p-3 cursor-pointer select-none transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
      onMouseEnter={cancelExit}
      onMouseLeave={() => scheduleExit(1500)}
      onClick={() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }}
    >
      {/* Result headline */}
      <div className={`text-sm font-bold ${color}`}>{headline}</div>
      <div className="text-[10px] text-muted-foreground mb-2">{detail}</div>

      {/* Mini 3×3 zone grid */}
      <div className="flex gap-1.5">
        {/* Row labels */}
        <div className="flex flex-col justify-around">
          {ROW_LABELS.map((lbl) => (
            <div
              key={lbl}
              className="text-[10px] text-muted-foreground font-mono w-6 text-right h-8.5 flex items-center justify-end pr-0.5"
            >
              {lbl}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {/* Col labels */}
          <div className="flex gap-1 mb-0.5">
            {COL_LABELS.map((lbl) => (
              <div
                key={lbl}
                className="flex-1 text-center text-[10px] text-muted-foreground font-mono"
              >
                {lbl}
              </div>
            ))}
          </div>

          {/* Zone cells */}
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex gap-1">
              {[0, 1, 2].map((col) => {
                const zt = zoneMap[row][col];
                const isLand = landing.row === row && landing.col === col;
                const isAim = aimed.row === row && aimed.col === col;
                const isSwing = batterSwing?.row === row && batterSwing?.col === col;

                const bg =
                  zt === "hot"
                    ? isMyBatter
                      ? "bg-amber-500/25 border-amber-500/55"
                      : "bg-red-500/25 border-red-500/55"
                    : zt === "cold"
                      ? "bg-violet-500/25 border-violet-400/60"
                      : "bg-card border-border";

                const ring =
                  result.isPerfect && isLand ? "ring-1 ring-amber-400/70" : "";

                return (
                  <div
                    key={`${row}-${col}`}
                    className={`flex-1 h-8.5 rounded border flex flex-col items-center justify-center ${bg} ${ring}`}
                  >
                    {(() => {
                      if (isMyBatter) {
                        // Batting mode: aimed = player swing, land = pitch
                        if (isLand && isAim) {
                          return (
                            <div className="flex items-center gap-0.5">
                              <span className="text-sm leading-none">🏏</span>
                              <span className="text-sm leading-none">⚾</span>
                            </div>
                          );
                        }
                        if (isLand) return <span className="text-sm leading-none">⚾</span>;
                        if (isAim) return <span className="text-sm leading-none opacity-60">🏏</span>;
                        return null;
                      } else {
                        // Pitching mode: aimed = pitcher target (🎯), land = pitch (⚾), isSwing = AI batter (🏏)
                        const icons: ReactNode[] = [];
                        if (isAim && !isLand) icons.push(<span key="aim" className="text-sm leading-none opacity-60">🎯</span>);
                        if (isLand) icons.push(<span key="land" className="text-sm leading-none">⚾</span>);
                        if (isAim && isLand) icons.unshift(<span key="aim2" className="text-sm leading-none opacity-60">🎯</span>);
                        if (isSwing) icons.push(<span key="swing" className="text-sm leading-none opacity-75">🏏</span>);
                        if (icons.length === 0) return null;
                        return <div className="flex items-center gap-0.5">{icons}</div>;
                      }
                    })()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground/70">
        <span>⚾ pitch</span>
        {isMyBatter ? (
          <span>🏏 swing</span>
        ) : (
          <>
            <span>🎯 aim</span>
            {batterSwing && <span>🏏 their read</span>}
          </>
        )}
        {controlMissed && (
          <span className="text-amber-500/60">· control miss</span>
        )}
        <span className="ml-auto opacity-40">tap to close</span>
      </div>
    </div>
  );
}
