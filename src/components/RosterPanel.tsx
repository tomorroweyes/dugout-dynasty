import { useMemo, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { STAT_TIER_COLORS } from "@/engine/statConfig";
import PlayerCard from "@/components/PlayerCard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/8bit/card";
import { Badge } from "@/components/ui/8bit/badge";
import { Button } from "@/components/ui/8bit/button";
import { GAME_CONSTANTS } from "@/engine/constants";
import { Player } from "@/types/game";
import { ClassSelectionDialog } from "@/components/ClassSelectionDialog";
import { PlayerClass } from "@/types/ability";
import { calculateSynergies } from "@/engine/synergySystem";
import { SINGLE_TRAIT_SYNERGIES, COMBO_SYNERGIES } from "@/engine/synergyConfig";

function RosterPanel() {
  const { team, autoFix, selectClass } = useGameStore();
  const [classSelectionPlayer, setClassSelectionPlayer] = useState<Player | null>(null);

  const handleSelectClass = (playerId: string, playerClass: PlayerClass) => {
    selectClass(playerId, playerClass);
    setClassSelectionPlayer(null);
  };

  if (!team) return null;

  // Convert team color to format expected by avatar generator (without #)
  const teamColor = team.colors?.primary?.replace("#", "");

  // Get unique players from roster (not lineup with duplicates)
  const batters = team.roster.filter((p) => p.role === "Batter");
  const starters = team.roster.filter((p) => p.role === "Starter");
  const relievers = team.roster.filter((p) => p.role === "Reliever");

  // Check if any player is not in lineup (incomplete roster setup)
  const lineupIds = new Set(team.lineup);
  const playersNotInLineup = team.roster.filter((p) => !lineupIds.has(p.id));
  const isIncomplete = playersNotInLineup.length > 0;
  const canAutoFix = isIncomplete;

  // Calculate active synergies from lineup players
  const lineupPlayers = useMemo(() =>
    team.lineup.map((id) => team.roster.find((p) => p.id === id)).filter((p): p is Player => !!p),
    [team.lineup, team.roster]
  );
  const synergies = useMemo(() => calculateSynergies(lineupPlayers), [lineupPlayers]);
  const hasAnySynergy = synergies.single.length > 0 || synergies.combo.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Your Team ({team.roster.length} players)
            </CardTitle>
            {canAutoFix && (
              <Button
                onClick={autoFix}
                size="sm"
                title="Fix lineup configuration"
              >
                Auto-Fix Lineup
              </Button>
            )}
          </div>
          {isIncomplete && (
            <p className="text-sm text-muted-foreground mt-2">
              <span className={STAT_TIER_COLORS.POOR.text}>
                {playersNotInLineup.length} player(s) not in lineup
              </span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active Synergies Summary */}
          {hasAnySynergy && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Active Synergies
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {synergies.single.map((s) => (
                  <Badge
                    key={s.synergy.id}
                    className={`text-xs font-medium ${
                      s.tier === "gold" ? "bg-yellow-500 text-black" :
                      s.tier === "silver" ? "bg-gray-400 text-black" :
                      "bg-amber-700 text-white"
                    }`}
                    title={s.synergy.tiers[s.tier].description}
                  >
                    {s.synergy.emoji} {s.synergy.name} ({s.tier})
                  </Badge>
                ))}
                {synergies.combo.map((c) => (
                  <Badge
                    key={c.synergy.id}
                    className="text-xs font-medium bg-purple-500 text-white"
                    title={c.synergy.description}
                  >
                    {c.synergy.emoji} {c.synergy.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Batters Section */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Batters ({batters.length})
            </h3>
            <div className="space-y-2">
              {batters.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isInLineup={lineupIds.has(player.id)}
                  teamColor={teamColor}
                  onRequestClassSelection={() => setClassSelectionPlayer(player)}
                />
              ))}
            </div>
          </div>

          {/* Pitchers Section */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Pitchers ({starters.length + relievers.length})
            </h3>
            <div className="space-y-2">
              {starters.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isInLineup={lineupIds.has(player.id)}
                  teamColor={teamColor}
                  onRequestClassSelection={() => setClassSelectionPlayer(player)}
                />
              ))}
              {relievers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isInLineup={lineupIds.has(player.id)}
                  teamColor={teamColor}
                  onRequestClassSelection={() => setClassSelectionPlayer(player)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Selection Dialog */}
      {classSelectionPlayer && (
        <ClassSelectionDialog
          player={classSelectionPlayer}
          open={!!classSelectionPlayer}
          onSelectClass={handleSelectClass}
          onClose={() => setClassSelectionPlayer(null)}
        />
      )}
    </div>
  );
}

export default RosterPanel;
