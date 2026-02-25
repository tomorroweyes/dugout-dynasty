import { Player } from "@/types/game";
import { EquippedItems } from "@/types/item";

/**
 * Test helper to add empty equipment to mock players
 * Use this when creating mock players in tests to ensure they have the equipment field
 */
export function withEmptyEquipment<T extends Partial<Player>>(player: T): T & { equipment: EquippedItems } {
  return {
    ...player,
    equipment: {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
  };
}
