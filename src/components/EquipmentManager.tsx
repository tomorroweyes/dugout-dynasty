import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { EquipmentSlots } from "./EquipmentSlots";
import { ItemCard } from "./ItemCard";
import { Card } from "./ui/8bit/card";
import { Package, Wrench, Zap } from "lucide-react";
import { Item, EquipmentSlot } from "@/types/item";
import { compareItems } from "@/engine/itemStatsCalculator";
import { generatePlayerAvatar } from "@/utils/avatarGenerator";

function canPlayerUseItem(item: Item, playerRole: "Batter" | "Starter" | "Reliever"): boolean {
  const hasBatterStats = item.stats.power !== undefined || item.stats.contact !== undefined || item.stats.speed !== undefined;
  const hasPitcherStats = item.stats.velocity !== undefined || item.stats.control !== undefined || item.stats.break !== undefined;
  if (playerRole === "Batter") return hasBatterStats;
  return hasPitcherStats;
}

function itemScore(item: Item | null): number {
  if (!item) return -1;
  return Object.values(item.stats).reduce((sum, v) => sum + (v ?? 0), 0);
}

export function EquipmentManager() {
  const team = useGameStore((state) => state.team);
  const equipItem = useGameStore((state) => state.equipItem);
  const inventory = useInventoryStore((state) => state.inventory);
  const sellItem = useInventoryStore((state) => state.sellItem);
  const getInventoryCount = useInventoryStore(
    (state) => state.getInventoryCount,
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const filledSlots = getInventoryCount();
  const maxSlots = inventory.length;

  if (!team) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
        <p className="text-gray-400">No team loaded</p>
      </Card>
    );
  }

  // Default to first player in lineup if nothing selected
  const selectedPlayer =
    team.roster.find((p) => p.id === selectedPlayerId) ||
    team.roster.find((p) => team.lineup.includes(p.id)) ||
    team.roster[0];

  const handleEquipItem = (item: Item) => {
    if (!selectedPlayer) {
      return;
    }

    equipItem(selectedPlayer.id, item.id);
  };

  const handleSellItem = (itemId: string) => {
    const goldEarned = sellItem(itemId);
    if (goldEarned > 0) {
      console.log(`Sold item for $${goldEarned}`);
    }
  };

  const getComparison = (item: Item) => {
    if (!selectedPlayer) return undefined;

    const currentItem = selectedPlayer.equipment[item.slot];
    return compareItems(currentItem, item);
  };

  // Count equipped items for a player
  const getEquippedCount = (playerId: string) => {
    const player = team.roster.find((p) => p.id === playerId);
    if (!player) return 0;

    return Object.values(player.equipment).filter((item) => item !== null)
      .length;
  };

  const handleAutoEquip = (playerId: string) => {
    const player = team.roster.find((p) => p.id === playerId);
    if (!player) return;

    const slots: EquipmentSlot[] = ["bat", "glove", "cap", "cleats", "accessory"];
    // Track which item IDs we've already committed so we don't double-pick
    const committed = new Set<string>();

    for (const slot of slots) {
      const candidates = inventory
        .filter((s) => s.item !== null)
        .map((s) => s.item!)
        .filter((item) => item.slot === slot && canPlayerUseItem(item, player.role) && !committed.has(item.id));

      if (candidates.length === 0) continue;

      const best = candidates.reduce((a, b) => itemScore(a) >= itemScore(b) ? a : b);
      if (itemScore(best) > itemScore(player.equipment[slot])) {
        committed.add(best.id);
        equipItem(playerId, best.id);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          <h2 className="text-xl font-bold">Equipment Manager</h2>
        </div>
        <div className="text-sm text-gray-400">
          {filledSlots} / {maxSlots} items
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Player List (Compact) */}
        <div className="lg:col-span-2">
          <Card className="p-3">
            <h3 className="text-xs font-bold mb-3 text-gray-400">ROSTER</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {team.roster.map((player) => {
                const isLineup = team.lineup.includes(player.id);
                const isSelected = selectedPlayer?.id === player.id;
                const equippedCount = getEquippedCount(player.id);

                return (
                  <div
                    key={player.id}
                    className={`w-full rounded border-2 transition-all ${
                      isSelected
                        ? "border-yellow-500 bg-yellow-500/10"
                        : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
                    }`}
                  >
                    {/* Clickable player info area */}
                    <button
                      onClick={() => setSelectedPlayerId(player.id)}
                      className="w-full p-2 text-left flex gap-2 items-center"
                    >
                      <div className="w-8 h-8 shrink-0 rounded overflow-hidden border border-border bg-muted">
                        <img
                          src={generatePlayerAvatar(player.name)}
                          alt={`${player.surname}'s avatar`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs truncate flex items-center gap-1">
                          {isLineup && <span className="text-green-500 text-[8px]">●</span>}
                          {player.surname}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {player.role} • L{player.level} • {equippedCount}/5
                        </div>
                      </div>
                    </button>
                    {/* Auto-equip button */}
                    <div className="px-2 pb-2">
                      <button
                        onClick={() => handleAutoEquip(player.id)}
                        title="Auto-equip best items from inventory"
                        className="w-full flex items-center justify-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        Auto
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* CENTER COLUMN: Equipment Slots */}
        <div className="lg:col-span-6">
          {selectedPlayer ? (
            <Card className="p-3">
              <EquipmentSlots player={selectedPlayer} showStats />
            </Card>
          ) : (
            <Card className="p-8 text-center h-full flex items-center justify-center">
              <div>
                <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">← Select a player to view equipment</p>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Inventory */}
        <div className="lg:col-span-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4" />
              <h3 className="text-sm font-bold text-gray-400">INVENTORY</h3>
            </div>

            {filledSlots === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 text-sm">Your inventory is empty</p>
                <p className="text-xs text-gray-500 mt-1">
                  Win matches to earn loot!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {(() => {
                  const allItems = inventory.filter((slot) => slot.item !== null);
                  const usableItems = selectedPlayer
                    ? allItems.filter((slot) => canPlayerUseItem(slot.item!, selectedPlayer.role))
                    : allItems;
                  const hiddenCount = allItems.length - usableItems.length;

                  return (
                    <>
                      {hiddenCount > 0 && (
                        <p className="text-xs text-gray-500 text-center">
                          {hiddenCount} item{hiddenCount !== 1 ? "s" : ""} hidden (wrong role)
                        </p>
                      )}
                      <div className="space-y-3">
                        {usableItems.map((slot, index) => (
                          <ItemCard
                            key={`${slot.item!.id}-${index}`}
                            item={slot.item!}
                            onEquip={
                              selectedPlayer
                                ? () => handleEquipItem(slot.item!)
                                : undefined
                            }
                            onSell={() => handleSellItem(slot.item!.id)}
                            comparison={getComparison(slot.item!)}
                          />
                        ))}
                      </div>
                      {usableItems.length === 0 && hiddenCount === 0 && filledSlots < maxSlots && (
                        <div className="text-center py-2 text-xs text-gray-600">
                          {maxSlots - filledSlots} empty slots
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Tips */}
      <Card className="p-3 bg-blue-900/20">
        <div className="text-sm text-gray-400">
          <p className="font-bold mb-1">💡 Quick Guide:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Select a player from the roster on the left</li>
            <li>Click "Equip" on any inventory item to equip it automatically</li>
            <li>Click "Unequip" to return items to your inventory</li>
            <li>Green ▲ means better stats, red ▼ means worse stats</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
