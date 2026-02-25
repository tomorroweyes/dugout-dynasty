import { useSettingsStore } from "@/store/settingsStore";

/**
 * Hook to check if the retro 8-bit theme is enabled
 * Directly subscribes to the settings store for immediate updates
 */
export const useRetroTheme = () => {
  const enabled = useSettingsStore((state) => state.enable8bitTheme);
  return { enabled };
};
