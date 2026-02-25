import { useState } from "react";
import { Week, OpponentTeam } from "@/types/league";
import { MatchResult } from "@/types/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GameDetailsModal } from "@/components/GameDetailsModal";

interface ScheduleViewProps {
  currentWeek: Week;
  teams: OpponentTeam[];
  humanTeamId: string;
}

export function ScheduleView({
  currentWeek,
  teams,
  humanTeamId,
}: ScheduleViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<{
    result: MatchResult;
    homeTeamName: string;
    awayTeamName: string;
  } | null>(null);

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.name || "Unknown Team";
  };

  const isHumanMatch = (homeId: string, awayId: string) => {
    return homeId === humanTeamId || awayId === humanTeamId;
  };

  const handleMatchClick = (
    match: typeof currentWeek.matches[0],
    homeTeam: string,
    awayTeam: string
  ) => {
    if (match.completed && match.result) {
      setSelectedMatch({
        result: match.result,
        homeTeamName: homeTeam,
        awayTeamName: awayTeam,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week {currentWeek.weekNumber} Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentWeek.matches.map((match, index) => {
          const isPlayerMatch = isHumanMatch(match.homeTeamId, match.awayTeamId);
          const homeTeam = getTeamName(match.homeTeamId);
          const awayTeam = getTeamName(match.awayTeamId);

          // For completed matches, determine scores
          // match.result has myRuns (home team) and opponentRuns (away team)
          const homeScore = match.result?.myRuns;
          const awayScore = match.result?.opponentRuns;

          return (
            <div
              key={index}
              onClick={() => handleMatchClick(match, homeTeam, awayTeam)}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                isPlayerMatch ? "border-primary bg-accent" : ""
              } ${match.completed ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}
            >
              <div className="flex-1">
                {match.completed && match.result ? (
                  // Completed match - show teams with scores
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`${match.awayTeamId === humanTeamId ? "font-bold text-primary" : "font-medium"}`}>
                        {match.awayTeamId === humanTeamId && "⭐ "}
                        {awayTeam}
                      </span>
                      <span className="text-muted-foreground">@</span>
                      <span className={`${match.homeTeamId === humanTeamId ? "font-bold text-primary" : "font-medium"}`}>
                        {match.homeTeamId === humanTeamId && "⭐ "}
                        {homeTeam}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-bold tabular-nums">
                      <span>{awayScore}</span>
                      <span className="text-muted-foreground">-</span>
                      <span>{homeScore}</span>
                    </div>
                  </div>
                ) : (
                  // Upcoming match - just show teams
                  <div className="text-sm">
                    <span className={`${match.awayTeamId === humanTeamId ? "font-bold text-primary" : "font-medium"}`}>
                      {match.awayTeamId === humanTeamId && "⭐ "}
                      {awayTeam}
                    </span>
                    <span className="text-muted-foreground"> @ </span>
                    <span className={`${match.homeTeamId === humanTeamId ? "font-bold text-primary" : "font-medium"}`}>
                      {match.homeTeamId === humanTeamId && "⭐ "}
                      {homeTeam}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-4">
                {match.completed ? (
                  isPlayerMatch && match.result ? (
                    <Badge variant={match.result.isWin ? "default" : "destructive"} className="font-bold">
                      {match.result.isWin ? "✓ WIN" : "✗ LOSS"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Final</Badge>
                  )
                ) : isPlayerMatch ? (
                  <Badge variant="default">Your Game</Badge>
                ) : (
                  <Badge variant="outline">Scheduled</Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      <GameDetailsModal
        match={selectedMatch?.result || null}
        open={!!selectedMatch}
        onOpenChange={(open) => !open && setSelectedMatch(null)}
        homeTeamName={selectedMatch?.homeTeamName}
        awayTeamName={selectedMatch?.awayTeamName}
      />
    </Card>
  );
}
