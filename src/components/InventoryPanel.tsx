import { useInventoryStore } from "@/store/inventoryStore";
import { useGameStore } from "@/store/gameStore";
import { ItemCard } from "./ItemCard";
import { Card } from "./ui/8bit/card";
import { Package, Trash2 } from "lucide-react";
import { Item } from "@/types/item";
import { compareItems } from "@/engine/itemStatsCalculator";
import { useState } from "react";

export function InventoryPanel() {
  const inventory = useInventoryStore((state) => state.inventory);
  const sellItem = useInventoryStore((state) => state.sellItem);
  const getInventoryCount = useInventoryStore((state) => state.getInventoryCount);
  const team = useGameStore((state) => state.team);
  const equipItem = useGameStore((state) => state.equipItem);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const filledSlots = getInventoryCount();
  const maxSlots = inventory.length;

  const handleEquip = (item: Item) => {
    if (!team || !selectedPlayerId) {
      alert("Please select a player from your roster first!");
      return;
    }

    equipItem(selectedPlayerId, item.id);
    setSelectedItem(null);
  };

  const handleSell = (itemId: string) => {
    const goldEarned = sellItem(itemId);
    if (goldEarned > 0) {
      // TODO: Show toast notification
      console.log(`Sold item for $${goldEarned}`);
    }
    setSelectedItem(null);
  };

  const getComparison = (item: Item) => {
    if (!team || !selectedPlayerId) return undefined;

    const player = team.roster.find((p) => p.id === selectedPlayerId);
    if (!player) return undefined;

    const currentItem = player.equipment[item.slot];
    return compareItems(currentItem, item);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          <h2 className="text-xl font-bold">Inventory</h2>
        </div>
        <div className="text-sm text-gray-400">
          {filledSlots} / {maxSlots} slots used
        </div>
      </div>

      {/* Player selector */}
      {team && (
        <Card className="p-3">
          <label className="block text-sm font-bold mb-2">
            Select Player to Equip:
          </label>
          <select
            value={selectedPlayerId || ""}
            onChange={(e) => setSelectedPlayerId(e.target.value || null)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          >
            <option value="">-- Choose a player --</option>
            {team.roster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.role}) - Lvl {player.level}
              </option>
            ))}
          </select>
        </Card>
      )}

      {/* Inventory grid */}
      {filledSlots === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">Your inventory is empty</p>
          <p className="text-sm text-gray-500 mt-1">
            Win matches to earn loot drops!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {inventory.map((slot, index) =>
            slot.item ? (
              <ItemCard
                key={`${slot.item.id}-${index}`}
                item={slot.item}
                onEquip={
                  selectedPlayerId ? () => handleEquip(slot.item!) : undefined
                }
                onSell={() => handleSell(slot.item!.id)}
                comparison={getComparison(slot.item)}
              />
            ) : (
              <Card
                key={`empty-${index}`}
                className="aspect-square flex items-center justify-center bg-gray-900/50 border-dashed"
              >
                <div className="text-gray-700 text-xs">Empty</div>
              </Card>
            )
          )}
        </div>
      )}

      {/* Quick actions */}
      {filledSlots > 0 && (
        <Card className="p-3 bg-gray-900/50">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Trash2 className="w-4 h-4" />
            <span>Tip: Sell junk items to make space for better loot!</span>
          </div>
        </Card>
      )}
    </div>
  );
}
