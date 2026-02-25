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
            const showRunsBanner = isLatest && lastRunsScored > 0;
            return (
              <div
                key={`${play.inning}-${play.isTop}-${i}`}
                className={
                  isLatest
                    ? "text-base leading-relaxed text-foreground"
                    : isRoutineOut(play)
                      ? "text-[10px] leading-tight text-muted-foreground/30"
                      : "text-xs leading-relaxed text-muted-foreground/60 border-b border-border/30 pb-1.5"
                }
              >
                {isRoutineOut(play) && !isLatest
                  ? `${play.batter}: ${play.outcome}`
                  : (play.narrativeText ?? `${play.batter}: ${play.outcome}`)}
                {play.perfectContact && (
                  <span className="ml-1 text-amber-400 font-bold text-[10px]">⭐ PERFECT</span>
                )}
                {play.paintedCorner && (
                  <span className="ml-1 text-blue-400 font-bold text-[10px]">🎯 CORNER</span>
                )}
                {showRunsBanner && (
                  <div className="mt-1.5 text-sm font-bold text-yellow-600 dark:text-yellow-300 animate-pulse">
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
