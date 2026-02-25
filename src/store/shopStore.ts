import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Item } from "@/types/item";
import { Player } from "@/types/game";
import { generateItem } from "@/engine/lootGenerator";
import { SAVE_CONFIG } from "@/config/saveConfig";

export interface ShopItem {
  item: Item;
  price: number;
  sold: boolean;
}

interface ShopState {
  stock: ShopItem[];
  lastRefreshTimestamp: number;

  refreshStock: (roster: Player[]) => void;
  purchaseItem: (itemId: string) => { item: Item; price: number } | null;
}

const SHOP_SIZE = 12;
const REFRESH_COST = 500;
const PRICE_MULTIPLIER = 3;

function calculatePrice(item: Item): number {
  return Math.floor(item.sellValue * PRICE_MULTIPLIER);
}

function generateShopStock(roster: Player[]): ShopItem[] {
  const avgLevel = roster.length > 0
    ? Math.max(1, Math.floor(roster.reduce((sum, p) => sum + p.level, 0) / roster.length))
    : 1;

  const roles: ("Batter" | "Starter" | "Reliever")[] = [
    "Batter", "Batter", "Batter", "Batter",
    "Batter", "Batter",
    "Starter", "Starter", "Starter",
    "Reliever", "Reliever", "Reliever",
  ];

  const stock: ShopItem[] = [];

  for (let i = 0; i < SHOP_SIZE; i++) {
    const role = roles[i % roles.length];
    const item = generateItem(role, avgLevel);
    stock.push({
      item,
      price: calculatePrice(item),
      sold: false,
    });
  }

  return stock;
}

export { REFRESH_COST };

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      stock: [],
      lastRefreshTimestamp: 0,

      refreshStock: (roster: Player[]) => {
        set({
          stock: generateShopStock(roster),
          lastRefreshTimestamp: Date.now(),
        });
      },

      purchaseItem: (itemId: string) => {
        const { stock } = get();
        const shopItem = stock.find((s) => s.item.id === itemId && !s.sold);
        if (!shopItem) return null;

        // Mark as sold
        set({
          stock: stock.map((s) =>
            s.item.id === itemId ? { ...s, sold: true } : s
          ),
        });

        return { item: shopItem.item, price: shopItem.price };
      },
    }),
    {
      name: `${SAVE_CONFIG.STORAGE_KEY}-shop`,
      version: 1,
      partialize: (state) => ({
        stock: state.stock,
        lastRefreshTimestamp: state.lastRefreshTimestamp,
      }),
    }
  )
);
