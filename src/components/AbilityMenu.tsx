import { Player } from "@/types/game";
import { getPlayerAbilities } from "@/engine/abilitySystem";
import { canActivateAbility } from "@/engine/abilitySystem";
import { Button } from "@/components/ui/8bit/button";
import { Card } from "@/components/ui/8bit/card";
import { Badge } from "@/components/ui/8bit/badge";
import { Sparkles, Zap } from "lucide-react";
import { Separator } from "@/components/ui/8bit/separator";

interface AbilityMenuProps {
  player: Player;
  onActivateAbility: (abilityId: string) => void;
  onSkip: () => void;
}

/**
 * Ability Menu Component
 *
 * Displays available abilities for a player during their at-bat.
 * Players can choose to activate an ability (spending spirit) or skip.
 *
 * Note: Currently designed for future interactive matches.
 * In auto-simulated matches, abilities are activated automatically.
 */
export function AbilityMenu({
  player,
  onActivateAbility,
  onSkip,
}: AbilityMenuProps) {
  // Get all unlocked abilities for this player
  const abilities = getPlayerAbilities(player);

  if (abilities.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p className="mb-2">No abilities unlocked yet.</p>
          <p className="text-sm">
            Reach level 5 and choose a class to unlock abilities!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choose Ability</h3>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="text-sm">
            {player.spirit.current}/{player.spirit.max} Spirit
          </span>
        </div>
      </div>

      <Separator />

      {/* Ability List */}
      <div className="grid gap-3">
        {abilities.map((ability) => {
          const { canActivate, reason } = canActivateAbility(
            player,
            ability.id
          );
          const playerAbility = player.abilities.find(
            (a) => a.abilityId === ability.id
          );

          return (
            <div
              key={ability.id}
              className={`border rounded-lg p-4 ${
                canActivate ? "hover:bg-accent/50" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {/* Ability Name & Rank */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{ability.iconEmoji}</span>
                    <div>
                      <h4 className="font-semibold text-sm">{ability.name}</h4>
                      {playerAbility && (
                        <Badge variant="outline" className="text-xs mt-0.5">
                          Rank {playerAbility.rank}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground mb-2">
                    {ability.description}
                  </p>

                  {/* Spirit Cost */}
                  <div className="flex items-center gap-2 text-xs">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>Cost: {ability.spiritCost} Spirit</span>
                  </div>

                  {/* Reason if can't activate */}
                  {!canActivate && reason && (
                    <p className="text-xs text-red-500 mt-2">{reason}</p>
                  )}
                </div>

                {/* Activate Button */}
                <Button
                  size="sm"
                  disabled={!canActivate}
                  onClick={() => onActivateAbility(ability.id)}
                  title={reason}
                >
                  Activate
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Skip Option */}
      <Button
        variant="outline"
        className="w-full"
        onClick={onSkip}
      >
        Skip (No Ability)
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Abilities modify your stats or outcomes for this at-bat only.
      </p>
    </Card>
  );
}
