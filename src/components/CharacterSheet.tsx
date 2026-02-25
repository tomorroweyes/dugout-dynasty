import { Player, isPitcher, BatterStats, PitcherStats } from "@/types/game";
import { CharacterSheet as CharacterSheetUI } from "@/components/ui/8bit/character-sheet";
import { Sparkles } from "lucide-react";
import { getStatColor } from "@/lib/utils";
import { getXpToNextLevel, isMaxLevel } from "@/engine/xpSystem";
import { generatePlayerAvatar } from "@/utils/avatarGenerator";
import { SkillTreePanel } from "@/components/SkillTreePanel";
import { useGameStore } from "@/store/gameStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/8bit/tabs";
import { Card } from "@/components/ui/8bit/card";

interface CharacterSheetProps {
  player: Player;
}

export function CharacterSheet({ player }: CharacterSheetProps) {
  const { unlockAbility, upgradeAbility } = useGameStore();
  const isPitcherRole = isPitcher(player);

  // Map player stats to primary attributes with dynamic colors based on stat quality
  const primaryAttributes = isPitcherRole
    ? [
        {
          name: "Velocity",
          shortName: "VEL",
          value: (player.stats as PitcherStats).velocity,
          color: getStatColor((player.stats as PitcherStats).velocity),
        },
        {
          name: "Control",
          shortName: "CTL",
          value: (player.stats as PitcherStats).control,
          color: getStatColor((player.stats as PitcherStats).control),
        },
        {
          name: "Break",
          shortName: "BRK",
          value: (player.stats as PitcherStats).break,
          color: getStatColor((player.stats as PitcherStats).break),
        },
      ]
    : [
        {
          name: "Power",
          shortName: "PWR",
          value: (player.stats as BatterStats).power,
          color: getStatColor((player.stats as BatterStats).power),
        },
        {
          name: "Contact",
          shortName: "CON",
          value: (player.stats as BatterStats).contact,
          color: getStatColor((player.stats as BatterStats).contact),
        },
        {
          name: "Glove",
          shortName: "GLV",
          value: (player.stats as BatterStats).glove,
          color: getStatColor((player.stats as BatterStats).glove),
        },
        {
          name: "Speed",
          shortName: "SPD",
          value: (player.stats as BatterStats).speed,
          color: getStatColor((player.stats as BatterStats).speed),
        },
      ];

  // Map XP to secondary stats with color coding
  const secondaryStats = [
    {
      name: "Total XP Earned",
      value: player.totalXpEarned,
      icon: <Sparkles className="w-4 h-4" />,
      color: "text-amber-500",
    },
  ];

  return (
    <Card className="max-w-4xl h-[70vh] overflow-hidden flex flex-col">
      <Tabs defaultValue="stats" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="flex-1 overflow-y-auto m-0 p-4">
          <CharacterSheetUI
            characterName={player.name}
            characterClass={player.class || player.role}
            characterLevel={player.level}
            avatarSrc={generatePlayerAvatar(player.name)}
            avatarFallback={player.name.substring(0, 2).toUpperCase()}
            showAvatar={true}
            showLevel={true}
            showHealth={false}
            showMana={player.class !== undefined && player.spirit !== undefined}
            mana={
              player.class && player.spirit
                ? { current: player.spirit.current, max: player.spirit.max }
                : undefined
            }
            showExperience={!isMaxLevel(player)}
            experience={
              isMaxLevel(player)
                ? undefined
                : { current: player.xp, max: getXpToNextLevel(player) }
            }
            primaryAttributes={primaryAttributes}
            secondaryStats={secondaryStats}
            showEquipment={false}
          />
        </TabsContent>

        <TabsContent value="skills" className="flex-1 overflow-y-auto m-0">
          <SkillTreePanel
            player={player}
            onUnlockAbility={unlockAbility}
            onUpgradeAbility={upgradeAbility}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
