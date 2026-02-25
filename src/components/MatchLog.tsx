import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { Trophy, X } from "lucide-react";
import { STAT_TIER_COLORS } from "@/engine/statConfig";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/8bit/card";
import { Badge } from "@/components/ui/8bit/badge";
import { Button } from "@/components/ui/8bit/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/8bit/tabs";
import BoxScore from "@/components/BoxScore";
import PlayByPlay from "@/components/PlayByPlay";
import { PostMatchInsightCards } from "@/components/PostMatchInsightCards";
import { generatePostMatchInsights } from "@/engine/postMatchInsights";

function MatchLog() {
  const matchLog = useGameStore((state) => state.matchLog);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  if (matchLog.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            No matches played yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {matchLog.map((match, index) => {
          const isExpanded = expandedMatch === index;

          // Calculate total innings from playByPlay if not present
          const totalInnings =
            match.totalInnings ??
            (match.playByPlay && match.playByPlay.length > 0
              ? Math.max(...match.playByPlay.map((p) => p.inning))
              : 9);

          return (
            <div
              key={match.timestamp}
              className={`rounded border ${
                match.isWin
                  ? `${STAT_TIER_COLORS.GOOD.bg} ${STAT_TIER_COLORS.GOOD.border}`
                  : `${STAT_TIER_COLORS.POOR.bg} ${STAT_TIER_COLORS.POOR.border}`
              }`}
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
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
                  <span className="text-sm text-muted-foreground">
                    Game #{matchLog.length - index}
                  </span>
                </div>

                <div className="text-sm mb-2">
                  <div className="font-semibold">
                    You {match.myRuns} - {match.opponentRuns} Opponent
                    {totalInnings > 9 && (
                      <span
                        className={`ml-2 text-xs font-bold ${STAT_TIER_COLORS.SOLID.text}`}
                      >
                        ({totalInnings} innings)
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    Earned: ${match.cashEarned}
                  </div>
                </div>

                {match.boxScore && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedMatch(isExpanded ? null : index)}
                    className="w-full"
                  >
                    {isExpanded ? "📊 Hide Details" : "📊 Show Details"}
                  </Button>
                )}
              </div>

              {isExpanded && match.boxScore && (
                <Tabs defaultValue="boxscore" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="boxscore">Box Score</TabsTrigger>
                    <TabsTrigger value="playbyplay">Play-by-Play</TabsTrigger>
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                  </TabsList>
                  <TabsContent value="boxscore">
                    <BoxScore match={match} />
                  </TabsContent>
                  <TabsContent value="playbyplay">
                    <PlayByPlay match={match} />
                  </TabsContent>
                  <TabsContent value="insights" className="p-3">
                    <PostMatchInsightCards
                      insights={generatePostMatchInsights(match)}
                      emphasized={!match.isWin}
                      defaultExpanded
                    />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default MatchLog;
