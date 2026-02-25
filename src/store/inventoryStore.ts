import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Item, InventorySlot, INVENTORY_SIZE } from "@/types/item";
import { SAVE_CONFIG } from "@/config/saveConfig";

interface InventoryState {
  // Inventory grid (50 slots)
  inventory: InventorySlot[];

  // Actions
  addItem: (item: Item) => boolean; // Returns true if added successfully
  removeItem: (itemId: string) => void;
  sellItem: (itemId: string) => number; // Returns gold earned
  getItemById: (itemId: string) => Item | null;
  getInventoryCount: () => number; // Number of filled slots
  isInventoryFull: () => boolean;
  resetInventory: () => void; // Reset inventory to initial state
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      // Initialize empty inventory
      inventory: Array(INVENTORY_SIZE)
        .fill(null)
        .map(() => ({ item: null })),

      /**
       * Add item to first available slot
       * Returns false if inventory full
       */
      addItem: (item: Item) => {
        const { inventory } = get();
        const emptySlotIndex = inventory.findIndex((slot) => slot.item === null);

        if (emptySlotIndex === -1) {
          // Inventory full
          return false;
        }

        const newInventory = [...inventory];
        newInventory[emptySlotIndex] = { item };

        set({ inventory: newInventory });
        return true;
      },

      /**
       * Remove item from inventory
       */
      removeItem: (itemId: string) => {
        const { inventory } = get();
        const newInventory = inventory.map((slot) =>
          slot.item?.id === itemId ? { item: null } : slot
        );
        set({ inventory: newInventory });
      },

      /**
       * Sell item for gold
       */
      sellItem: (itemId: string) => {
        const item = get().getItemById(itemId);
        if (!item) return 0;

        const goldEarned = item.sellValue;
        get().removeItem(itemId);

        return goldEarned;
      },

      /**
       * Get item by ID from inventory
       */
      getItemById: (itemId: string) => {
        const { inventory } = get();
        const slot = inventory.find((s) => s.item?.id === itemId);
        return slot?.item || null;
      },

      /**
       * Get number of filled inventory slots
       */
      getInventoryCount: () => {
        const { inventory } = get();
        return inventory.filter((s) => s.item !== null).length;
      },

      /**
       * Check if inventory is full
       */
      isInventoryFull: () => {
        const { inventory } = get();
        return inventory.every((s) => s.item !== null);
      },

      /**
       * Reset inventory to initial state
       */
      resetInventory: () => {
        set({
          inventory: Array(INVENTORY_SIZE)
            .fill(null)
            .map(() => ({ item: null })),
        });
      },
    }),
    {
      name: `${SAVE_CONFIG.STORAGE_KEY}-inventory`,
      version: 1,
      partialize: (state) => ({
        inventory: state.inventory,
        // Exclude pendingDrops from persistence - it's temporary UI state
      }),
    }
  )
);
