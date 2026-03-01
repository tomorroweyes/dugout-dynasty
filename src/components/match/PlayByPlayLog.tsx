import { RefObject } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/8bit/card";
import type { PlayByPlayEvent } from "@/types/game";

const ROUTINE_OUT_OUTCOMES = ["groundout", "flyout", "lineout", "popout"];

function isRoutineOut(play: PlayByPlayEvent): boolean {
  return ROUTINE_OUT_OUTCOMES.includes(play.outcome) && !(play.rbi && play.rbi > 0);
}

interface PlayByPlayLogProps {
  halfInningPlays: PlayByPlayEvent[];
  lastRunsScored: number;
  inningComplete: boolean;
  inning: number;
  isTop: boolean;
  playLogRef: RefObject<HTMLDivElement>;
}

export function PlayByPlayLog({
  halfInningPlays,
  lastRunsScored,
  inningComplete,
  inning,
  isTop,
  playLogRef,
}: PlayByPlayLogProps) {
  const lastEvent = halfInningPlays[halfInningPlays.length - 1];

  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm text-muted-foreground">
          Play-by-Play
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={playLogRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-2"
      >
        {halfInningPlays.length > 0 ? (
          halfInningPlays.map((play, i) => {
            const isLatest = i === halfInningPlays.length - 1;
            const isScoring = (play.rbi ?? 0) > 0;
            const isRoutine = isRoutineOut(play) && !isLatest;

            // Scoring plays stay visually distinct even as they age in the log
            let rowClass: string;
            if (isLatest) {
              rowClass = "text-base leading-relaxed text-foreground";
            } else if (isScoring) {
              rowClass = "text-xs leading-relaxed text-amber-600 dark:text-amber-400 border-b border-amber-500/20 pb-1.5";
            } else if (isRoutine) {
              rowClass = "text-[10px] leading-tight text-muted-foreground/30";
            } else {
              rowClass = "text-xs leading-relaxed text-muted-foreground/60 border-b border-border/30 pb-1.5";
            }

            return (
              <div key={`${play.inning}-${play.isTop}-${i}`} className={rowClass}>
                {isRoutine
                  ? `${play.batter}: ${play.outcome}`
                  : (play.narrativeText ?? `${play.batter}: ${play.outcome}`)}

                {/* Scoring badge — appears on any scoring play, not just latest */}
                {isScoring && !isLatest && (
                  <span className="ml-1.5 text-[10px] font-bold text-amber-500">
                    +{play.rbi} {play.rbi === 1 ? "run" : "runs"}
                  </span>
                )}
                {play.perfectContact && (
                  <span className="ml-1 text-amber-400 font-bold text-[10px]">⭐ PERFECT</span>
                )}
                {play.paintedCorner && (
                  <span className="ml-1 text-blue-400 font-bold text-[10px]">🎯 CORNER</span>
                )}
                {/* Latest play scoring banner */}
                {isLatest && isScoring && (
                  <div className="mt-1.5 text-sm font-bold text-amber-500 dark:text-amber-400">
                    {lastRunsScored === 1
                      ? "A RUN SCORES!"
                      : `${lastRunsScored} RUNS SCORE!`}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Waiting for first pitch...
          </p>
        )}

        {inningComplete && lastEvent && (
          <p className="text-sm text-muted-foreground mt-3">
            End of Inning {inning}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
