import { Player } from "@/types/game";
import { EquipmentSlot, EQUIPMENT_SLOT_NAMES, getBatSlotName } from "@/types/item";
import { useGameStore } from "@/store/gameStore";
import { ItemCard } from "./ItemCard";
import { Card } from "./ui/8bit/card";
import { Hand, FootprintsIcon, Glasses, HardHat, CircleDot } from "lucide-react";
import { calculateEquipmentBonuses } from "@/engine/itemStatsCalculator";

interface EquipmentSlotsProps {
  player: Player;
  showStats?: boolean;
}

const SLOT_ICONS: Record<EquipmentSlot, React.ComponentType<any>> = {
  bat: CircleDot,
  glove: Hand,
  cap: HardHat,
  cleats: FootprintsIcon,
  accessory: Glasses,
};

export function EquipmentSlots({
  player,
  showStats = true,
}: EquipmentSlotsProps) {
  const unequipItem = useGameStore((state) => state.unequipItem);

  const slots: EquipmentSlot[] = [
    "bat",
    "glove",
    "cap",
    "cleats",
    "accessory",
  ];

  const equipmentBonuses = calculateEquipmentBonuses(player.equipment);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold">{player.name}</h3>
          <p className="text-xs text-gray-400">
            {player.role} • Level {player.level}
          </p>
        </div>
      </div>

      {/* Equipment slots */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {slots.map((slot) => {
          const item = player.equipment[slot];
          const Icon = SLOT_ICONS[slot];

          return (
            <div key={slot} className="space-y-1">
              <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                <Icon className="w-2.5 h-2.5" />
                {slot === "bat" ? getBatSlotName(player.role) : EQUIPMENT_SLOT_NAMES[slot]}
              </div>

              {item ? (
                <ItemCard
                  item={item}
                  onEquip={() => unequipItem(player.id, slot)}
                  isEquipped
                  compact
                />
              ) : (
                <Card className="aspect-square flex flex-col items-center justify-center bg-gray-900/50 border-dashed p-3">
                  <Icon className="w-8 h-8 text-gray-700 mb-1" />
                  <div className="text-xs text-gray-600 text-center">
                    No {slot === "bat" ? getBatSlotName(player.role) : EQUIPMENT_SLOT_NAMES[slot]}
                  </div>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      {/* Equipment bonuses summary */}
      {showStats && Object.keys(equipmentBonuses).length > 0 && (
        <Card className="p-2 bg-gradient-to-r from-green-900/20 to-blue-900/20">
          <div className="text-xs font-bold mb-1">Equipment Bonuses</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            {equipmentBonuses.power && (
              <div className="flex justify-between">
                <span className="text-gray-400">Power</span>
                <span className="text-green-500 font-mono">
                  +{equipmentBonuses.power}
                </span>
              </div>
            )}
            {equipmentBonuses.contact && (
              <div className="flex justify-between">
                <span className="text-gray-400">Contact</span>
                <span className="text-green-500 font-mono">
                  +{equipmentBonuses.contact}
                </span>
              </div>
            )}
            {equipmentBonuses.glove && (
              <div className="flex justify-between">
                <span className="text-gray-400">Glove</span>
                <span className="text-green-500 font-mono">
                  +{equipmentBonuses.glove}
                </span>
              </div>
            )}
            {equipmentBonuses.velocity && (
              <div className="flex justify-between">
                <span className="text-gray-400">Velocity</span>
                <span className="text-green-500 font-mono">
                  +{equipmentBonuses.velocity}
                </span>
              </div>
            )}
            {equipmentBonuses.control && (
              <div className="flex justify-between">
                <span className="text-gray-400">Control</span>
                <span className="text-green-500 font-mono">
                  +{equipmentBonuses.control}
                </span>
              </div>
            )}
            {equipmentBonuses.break && (
              <div className="flex justify-between">
                <span className="text-gray-400">Break</span>
                <span className="text-green-500 font-mono">
                  +{equipmentBonuses.break}
                </span>
              </div>
            )}
            {equipmentBonuses.xpBonus && (
              <div className="flex justify-between">
                <span className="text-gray-400">XP Bonus</span>
                <span className="text-purple-500 font-mono">
                  +{equipmentBonuses.xpBonus}%
                </span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
