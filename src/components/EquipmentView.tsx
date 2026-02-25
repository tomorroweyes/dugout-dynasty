import { useGameStore } from "@/store/gameStore";
import { EquipmentSlots } from "./EquipmentSlots";
import { Card } from "./ui/8bit/card";
import { Shield, Users } from "lucide-react";
import { useState } from "react";
import { Player } from "@/types/game";

export function EquipmentView() {
  const team = useGameStore((state) => state.team);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  if (!team) {
    return (
      <Card className="p-8 text-center">
        <Shield className="w-12 h-12 mx-auto mb-3 text-gray-600" />
        <p className="text-gray-400">No team loaded</p>
      </Card>
    );
  }

  // Default to first player in lineup if nothing selected
  const displayPlayer = selectedPlayer || team.roster.find(p => team.lineup.includes(p.id)) || team.roster[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5" />
        <h2 className="text-xl font-bold">Equipment Management</h2>
      </div>

      {/* Player selector grid */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4" />
          <h3 className="font-bold">Select Player</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {team.roster.map((player) => {
            const isLineup = team.lineup.includes(player.id);
            const isSelected = displayPlayer?.id === player.id;

            return (
              <button
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="text-sm font-bold truncate">{player.name}</div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span>{player.role}</span>
                  {isLineup && <span className="text-green-500">●</span>}
                </div>
                <div className="text-xs text-gray-500">Lvl {player.level}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Equipment slots for selected player */}
      {displayPlayer && (
        <Card className="p-4">
          <EquipmentSlots player={displayPlayer} showStats />
        </Card>
      )}

      {/* Help text */}
      <Card className="p-3 bg-blue-900/20">
        <div className="text-sm text-gray-400">
          <p className="font-bold mb-1">💡 Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Go to the Inventory tab to equip items from your inventory</li>
            <li>Click "Unequip" on any equipped item to return it to inventory</li>
            <li>Equipment bonuses apply immediately to player stats</li>
            <li>Higher rarity items provide better stat bonuses</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
