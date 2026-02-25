/**
 * Settings Store - User preferences and game options
 * Persisted to localStorage separately from game state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";

interface SettingsState extends UserSettings {
  // Actions
  setSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default settings
      ...DEFAULT_SETTINGS,

      // Actions
      setSetting: (key, value) => set({ [key]: value }),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "dustycleats-settings", // localStorage key
      storage: createJSONStorage(() => localStorage),

      // Only persist the settings, not the action functions
      partialize: (state) => {
        const { setSetting, resetSettings, ...settings } = state;
        return settings;
      },
    }
  )
);
