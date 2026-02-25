import { MatchResult } from "@/types/game";
import { Dialog, DialogContent, DialogHeader, DialogBody } from "@/components/ui/8bit/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BoxScore from "@/components/BoxScore";
import PlayByPlay from "@/components/PlayByPlay";
import { EngineTraceViewer } from "@/components/EngineTraceViewer";
import { Badge } from "@/components/ui/badge";
import { Trophy, X } from "lucide-react";

interface GameDetailsModalProps {
  match: MatchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeTeamName?: string;
  awayTeamName?: string;
}

export function GameDetailsModal({
  match,
  open,
  onOpenChange,
  homeTeamName = "Home",
  awayTeamName = "Away",
}: GameDetailsModalProps) {
  if (!match) return null;

  // Calculate total innings from playByPlay if not present
  const totalInnings =
    match.totalInnings ??
    (match.playByPlay && match.playByPlay.length > 0
      ? Math.max(...match.playByPlay.map((p) => p.inning))
      : 9);

  const hasTrace = !!match.traceLog;
  const tabCount = hasTrace ? 3 : 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant={match.isWin ? "default" : "destructive"}>
              {match.isWin ? (
                <>
                  <Trophy className="w-3 h-3 mr-1 inline-block" />
                  WIN
                </>
              ) : (
                <>
                  <X className="w-3 h-3 mr-1 inline-block" />
                  LOSS
                </>
              )}
            </Badge>
          </div>
          <h2 className="text-xl font-semibold">
            {awayTeamName} @ {homeTeamName}
          </h2>
          <div className="text-lg font-bold mt-2">
            Final: {match.myRuns} - {match.opponentRuns}
            {totalInnings > 9 && (
              <span className="ml-2 text-sm text-muted-foreground">
                ({totalInnings} innings)
              </span>
            )}
          </div>
        </DialogHeader>
        <DialogBody>
          {match.boxScore ? (
            <Tabs defaultValue="boxscore" className="w-full">
              <TabsList className={`grid w-full grid-cols-${tabCount}`}>
                <TabsTrigger value="boxscore">Box Score</TabsTrigger>
                <TabsTrigger value="playbyplay">Play-by-Play</TabsTrigger>
                {hasTrace && <TabsTrigger value="trace">Engine Trace</TabsTrigger>}
              </TabsList>
              <TabsContent value="boxscore">
                <BoxScore match={match} />
              </TabsContent>
              <TabsContent value="playbyplay">
                <PlayByPlay match={match} />
              </TabsContent>
              {hasTrace && match.traceLog && (
                <TabsContent value="trace">
                  <EngineTraceViewer traceLog={match.traceLog} />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No detailed stats available for this game.
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
