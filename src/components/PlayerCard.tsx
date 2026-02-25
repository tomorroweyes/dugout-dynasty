import { useState } from "react";
import { Player, isPitcher, BatterStats, PitcherStats } from "@/types/game";
import { useGameStore } from "@/store/gameStore";
import {
  Flame,
  Wind,
  Star,
  Sparkles,
  Trophy,
  Shield,
  Activity,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/8bit/button";
import { Badge } from "@/components/ui/8bit/badge";
import { Dialog } from "@/components/ui/8bit/dialog";
import { CharacterSheet } from "@/components/CharacterSheet";
import { Progress } from "@/components/ui/8bit/progress";
import {
  getBatterOverall,
  getPitcherOverall,
  getStatColor,
} from "@/engine/statConfig";
import {
  getXpProgressPercent,
  getXpToNextLevel,
  isMaxLevel,
} from "@/engine/xpSystem";
import { generatePlayerAvatar } from "@/utils/avatarGenerator";
import { cn } from "@/lib/utils";
import { ARCHETYPE_INFO } from "@/types/ability";
import { ALL_ABILITIES } from "@/data/abilities";
import { TRAIT_EMOJI } from "@/engine/synergyConfig";

interface PlayerCardProps {
  player: Player;
  isInLineup: boolean;
  teamColor?: string;
  onRequestClassSelection?: () => void;
}


// Get rarity/tier based on overall rating
function getPlayerTier(overall: number): {
  name: string;
  color: string;
  glow: string;
  icon: React.ReactNode;
} {
  if (overall >= 90) return {
    name: "Legendary",
    color: "from-purple-500 to-pink-500",
    glow: "shadow-lg shadow-purple-500/50",
    icon: <Trophy className="w-4 h-4" />
  };
  if (overall >= 80) return {
    name: "Elite",
    color: "from-yellow-500 to-orange-500",
    glow: "shadow-lg shadow-yellow-500/50",
    icon: <Star className="w-4 h-4" />
  };
  if (overall >= 70) return {
    name: "Pro",
    color: "from-blue-500 to-cyan-500",
    glow: "shadow-md shadow-blue-500/30",
    icon: <Sparkles className="w-4 h-4" />
  };
  if (overall >= 60) return {
    name: "Rising Star",
    color: "from-green-500 to-emerald-500",
    glow: "shadow-md shadow-green-500/30",
    icon: <Activity className="w-4 h-4" />
  };
  return {
    name: "Rookie",
    color: "from-gray-500 to-slate-500",
    glow: "shadow",
    icon: null
  };
}

function PlayerCard({ player, isInLineup, teamColor, onRequestClassSelection }: PlayerCardProps) {
  const swapPlayers = useGameStore((state) => state.swapPlayers);
  const [showSheet, setShowSheet] = useState(false);

  const needsClassSelection = !player.class;

  const isPit = isPitcher(player);
  const overallQuality = isPit
    ? getPitcherOverall(player.stats as PitcherStats)
    : getBatterOverall(player.stats as BatterStats);

  const tier = getPlayerTier(overallQuality);
  const RoleIcon = player.role === "Starter" ? Flame : player.role === "Reliever" ? Wind : null;

  // Get equipped items count
  const equippedCount = player.equipment
    ? Object.values(player.equipment).filter(item => item !== null).length
    : 0;

  return (
    <>
      <div
        className={cn(
          "relative rounded-lg overflow-hidden transition-all duration-300 cursor-pointer group",
          "hover:scale-[1.02] hover:-translate-y-1",
          tier.glow,
          needsClassSelection && "ring-2 ring-yellow-500 ring-offset-2"
        )}
        onClick={() => {
          if (needsClassSelection && onRequestClassSelection) {
            onRequestClassSelection();
          } else {
            setShowSheet(true);
          }
        }}
      >
        {/* Gradient Background based on tier */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity",
          tier.color
        )} />

        {/* Border glow effect */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-30 transition-opacity blur-sm",
          tier.color
        )} />

        {/* Main Card Content */}
        <div className="relative border-2 border-border/50 rounded-lg p-4 bg-card/95 backdrop-blur">
          <div className="flex gap-4">
            {/* Left: Avatar with level badge */}
            <div className="relative flex-shrink-0">
              <div className={cn(
                "w-24 h-24 rounded-lg overflow-hidden border-4 transition-all",
                `border-transparent bg-gradient-to-br ${tier.color}`
              )}>
                <div className="w-full h-full border-2 border-background rounded-md overflow-hidden">
                  <img
                    src={generatePlayerAvatar(player.name, "pixelArt", { teamColor })}
                    alt={`${player.name}'s avatar`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

            </div>

            {/* Right: Player Info */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Top Row: Name, Level, Actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg leading-tight truncate">
                      {player.name}
                    </h3>

                    {/* Level Badge */}
                    <Badge className="bg-amber-500 text-white font-bold px-2 py-0.5">
                      Level {player.level}
                    </Badge>
                  </div>

                  {/* Role and Class */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {player.class ? (
                      <Badge className="bg-purple-500 text-white font-semibold px-2 py-0.5">
                        {ARCHETYPE_INFO[player.class]?.iconEmoji} {player.class}
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500 text-black font-semibold px-2 py-0.5">
                        ⚠️ Click to Choose Class
                      </Badge>
                    )}

                    {player.role !== "Batter" && (
                      <Badge variant="outline" className="font-medium">
                        {RoleIcon && <RoleIcon className="w-3 h-3 mr-1 inline-block" />}
                        {player.role}
                      </Badge>
                    )}

                    {equippedCount > 0 && (
                      <Badge variant="outline" className="font-medium">
                        <Shield className="w-3 h-3 mr-1 inline-block" />
                        {equippedCount} items
                      </Badge>
                    )}

                    {/* Trait Badges */}
                    {player.traits?.length > 0 && player.traits.map((trait) => (
                      <Badge
                        key={trait}
                        variant="outline"
                        className="font-medium text-xs px-1.5 py-0"
                        title={trait}
                      >
                        {TRAIT_EMOJI[trait]} {trait}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  size="sm"
                  variant={isInLineup ? "destructive" : "default"}
                  onClick={(e) => {
                    e.stopPropagation();
                    swapPlayers(player.id);
                  }}
                  className="flex-shrink-0"
                >
                  {isInLineup ? "Remove" : "Add"}
                </Button>
              </div>

              {/* XP Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Experience
                  </span>
                  <span className="font-bold text-amber-500">
                    {isMaxLevel(player) ? "MAX LEVEL" : `${player.xp} / ${getXpToNextLevel(player)} XP`}
                  </span>
                </div>
                <Progress
                  value={isMaxLevel(player) ? 100 : getXpProgressPercent(player)}
                  className="h-2"
                  progressBg="bg-gradient-to-r from-amber-500 to-orange-500"
                />
              </div>

              {/* Abilities or Archetype Strengths */}
              {player.class && player.abilities.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <BookOpen className="w-3 h-3" />
                    <span>Unlocked Abilities ({player.abilities.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.abilities.map((ability) => {
                      const abilityData = ALL_ABILITIES[ability.abilityId];
                      if (!abilityData) return null;
                      return (
                        <Badge
                          key={ability.abilityId}
                          variant="outline"
                          className="text-xs font-medium px-2 py-0.5"
                          title={abilityData.description}
                        >
                          {abilityData.iconEmoji} {abilityData.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ) : player.class ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <Star className="w-3 h-3" />
                    <span>Archetype Strengths</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ARCHETYPE_INFO[player.class].strengths.map((strength) => (
                      <Badge
                        key={strength}
                        variant="outline"
                        className="text-xs font-medium px-2 py-0.5"
                      >
                        {strength}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <Activity className="w-3 h-3" />
                    <span>Quick Stats</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {isPit ? (
                      <>
                        <QuickStat
                          icon="🚀"
                          value={(player.stats as PitcherStats).velocity}
                          label="VEL"
                        />
                        <QuickStat
                          icon="🎯"
                          value={(player.stats as PitcherStats).control}
                          label="CTL"
                        />
                        <QuickStat
                          icon="🌀"
                          value={(player.stats as PitcherStats).break}
                          label="BRK"
                        />
                      </>
                    ) : (
                      <>
                        <QuickStat
                          icon="💪"
                          value={(player.stats as BatterStats).power}
                          label="PWR"
                        />
                        <QuickStat
                          icon="👁️"
                          value={(player.stats as BatterStats).contact}
                          label="CON"
                        />
                        <QuickStat
                          icon="🧤"
                          value={(player.stats as BatterStats).glove}
                          label="GLV"
                        />
                        <QuickStat
                          icon="👟"
                          value={(player.stats as BatterStats).speed}
                          label="SPD"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showSheet} onOpenChange={setShowSheet}>
        <CharacterSheet player={player} />
      </Dialog>
    </>
  );
}

// Quick stat component (for players without class)
function QuickStat({
  icon,
  value,
  label
}: {
  icon: string;
  value: number;
  label: string;
}) {
  const colorClass = getStatColor(value);

  return (
    <div className="flex flex-col items-center bg-muted/50 rounded-md p-1.5 border border-border/50">
      <div className="text-sm leading-none mb-0.5">{icon}</div>
      <div className={cn("text-base font-bold tabular-nums", colorClass)}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}

export default PlayerCard;
