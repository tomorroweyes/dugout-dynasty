import { useShopStore, REFRESH_COST } from "@/store/shopStore";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { ItemCard } from "./ItemCard";
import { Button } from "./ui/8bit/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "./ui/8bit/card";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Item } from "@/types/item";

function isBatterItem(item: Item) {
  return item.stats.power !== undefined || item.stats.contact !== undefined || item.stats.speed !== undefined;
}

export function Shop() {
  const stock = useShopStore((s) => s.stock);
  const refreshStock = useShopStore((s) => s.refreshStock);
  const purchaseItem = useShopStore((s) => s.purchaseItem);

  const team = useGameStore((s) => s.team);
  const setTeam = useGameStore.setState;

  const addItem = useInventoryStore((s) => s.addItem);
  const isInventoryFull = useInventoryStore((s) => s.isInventoryFull);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleBuy = (itemId: string) => {
    if (!team) return;

    const shopItem = stock.find((s) => s.item.id === itemId && !s.sold);
    if (!shopItem) return;

    if (team.cash < shopItem.price) {
      showMessage("Not enough cash!", "error");
      return;
    }

    if (isInventoryFull()) {
      showMessage("Inventory full! Sell items first.", "error");
      return;
    }

    const result = purchaseItem(itemId);
    if (!result) return;

    addItem(result.item);
    setTeam((state) => ({
      team: state.team ? { ...state.team, cash: state.team.cash - result.price } : null,
    }));

    showMessage(`Purchased ${result.item.name}!`, "success");
  };

  const handleRefresh = () => {
    if (!team) return;

    if (team.cash < REFRESH_COST) {
      showMessage("Not enough cash to refresh!", "error");
      return;
    }

    setTeam((state) => ({
      team: state.team ? { ...state.team, cash: state.team.cash - REFRESH_COST } : null,
    }));
    refreshStock(team.roster);
    showMessage("Shop stock refreshed!", "success");
  };

  // Auto-generate stock if empty
  if (stock.length === 0 && team) {
    refreshStock(team.roster);
  }

  const availableItems = stock.filter((s) => !s.sold);
  const hittingItems = availableItems.filter((s) => isBatterItem(s.item));
  const pitchingItems = availableItems.filter((s) => !isBatterItem(s.item));

  const renderGrid = (items: typeof availableItems) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((shopItem) => (
        <div key={shopItem.item.id} className="space-y-1">
          <ItemCard item={shopItem.item} compact />
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-bold text-yellow-500">
              ${shopItem.price}
            </span>
            <Button
              size="sm"
              onClick={() => handleBuy(shopItem.item.id)}
              disabled={!team || team.cash < shopItem.price || isInventoryFull()}
              className="text-xs px-2 py-0.5 h-auto"
            >
              Buy
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Shop</CardTitle>
          <div className="flex items-center gap-3">
            {message && (
              <span
                className={`text-sm font-bold ${
                  message.type === "success" ? "text-green-500" : "text-red-500"
                }`}
              >
                {message.text}
              </span>
            )}
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={!team || team.cash < REFRESH_COST}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh (${REFRESH_COST})
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Stock refreshes after each match. Buy gear for your team!
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {availableItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Shop is empty. Refresh to get new stock!
          </p>
        ) : (
          <>
            {hittingItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">⚾ Hitting</h3>
                {renderGrid(hittingItems)}
              </div>
            )}
            {pitchingItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">🔥 Pitching</h3>
                {renderGrid(pitchingItems)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
