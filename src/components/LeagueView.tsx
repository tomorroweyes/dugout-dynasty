import { League } from "@/types/league";
import { GAME_CONSTANTS } from "@/engine/constants";
import { StandingsTable } from "./StandingsTable";
import { ScheduleView } from "./ScheduleView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface LeagueViewProps {
  league: League;
  onPlayMatch: () => void;
  onCompleteWeek: () => void;
}

export function LeagueView({ league, onPlayMatch, onCompleteWeek }: LeagueViewProps) {
  const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[league.tier];
  const currentWeek = league.schedule.weeks[league.currentWeek];

  // Find if player has played their match this week
  const playerMatch = currentWeek?.matches.find(
    (m) =>
      m.homeTeamId === league.humanTeamId || m.awayTeamId === league.humanTeamId
  );
  const hasPlayedMatch = playerMatch?.completed || false;

  // Check if all matches are complete
  const allMatchesComplete = currentWeek?.matches.every((m) => m.completed) || false;

  return (
    <div className="space-y-6">
      {/* League Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{tierConfig.name}</CardTitle>
              <CardDescription>
                Season {league.season} • Week {league.currentWeek + 1} of {league.totalWeeks}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {league.tier}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Current Week Schedule */}
      {currentWeek && (
        <div className="space-y-4">
          <ScheduleView
            currentWeek={currentWeek}
            teams={league.teams}
            humanTeamId={league.humanTeamId}
          />

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!hasPlayedMatch && (
              <Button onClick={onPlayMatch} size="lg" className="flex-1">
                Play This Week's Match
              </Button>
            )}
            {hasPlayedMatch && !allMatchesComplete && (
              <Button onClick={onCompleteWeek} size="lg" className="flex-1">
                Simulate Rest of Week
              </Button>
            )}
            {allMatchesComplete && (
              <div className="flex-1 text-center text-sm text-muted-foreground">
                Week complete. Check standings below.
              </div>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Standings */}
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
          <CardDescription>
            Top {tierConfig.promotionSlots} teams promote
            {tierConfig.relegationSlots > 0 &&
              ` • Bottom ${tierConfig.relegationSlots} teams relegate`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StandingsTable
            standings={league.standings}
            humanTeamId={league.humanTeamId}
            promotionSlots={tierConfig.promotionSlots}
            relegationSlots={tierConfig.relegationSlots}
          />
        </CardContent>
      </Card>
    </div>
  );
}
