/**
 * User Settings Types
 * Extensible architecture for user preferences and game options
 */

/**
 * User settings interface
 * Add new settings here as the game expands
 */
export interface UserSettings {
  // Roster Management
  autoRotatePitchers: boolean;

  // Match Gameplay
  interactiveMatchMode: boolean;

  // UI Preferences
  enable8bitTheme: boolean;

  // Developer / Advanced
  enableEngineTrace: boolean;
}

/**
 * Default settings - used for initialization and reset
 */
export const DEFAULT_SETTINGS: UserSettings = {
  autoRotatePitchers: false,
  interactiveMatchMode: true, // Default to interactive for more engagement
  enable8bitTheme: true, // Default to retro style
  enableEngineTrace: false,
};

/**
 * Settings metadata for UI generation
 * Extensible pattern for adding new settings without touching UI code
 */
export interface SettingMetadata {
  key: keyof UserSettings;
  label: string;
  description: string;
  category: "roster" | "gameplay" | "ui" | "advanced";
  type: "boolean" | "number" | "select";
  options?: { value: string | number | boolean; label: string }[];
}

export const SETTINGS_METADATA: SettingMetadata[] = [
  {
    key: "autoRotatePitchers",
    label: "Auto-Rotate Pitchers",
    description:
      "No longer needed - pitcher rotation is handled automatically",
    category: "roster",
    type: "boolean",
  },
  {
    key: "interactiveMatchMode",
    label: "Interactive Match Mode",
    description:
      "Play matches batter-by-batter with ability selection. Turn off for instant auto-simulation.",
    category: "gameplay",
    type: "boolean",
  },
  {
    key: "enable8bitTheme",
    label: "8-Bit Retro Theme",
    description:
      "Enable retro 8-bit pixelated styling with Press Start 2P font. Turn off for a cleaner modern look.",
    category: "ui",
    type: "boolean",
  },
  {
    key: "enableEngineTrace",
    label: "Engine Trace Log",
    description:
      "Capture detailed engine trace data for every at-bat. Shows all rolls, stat pipelines, and decision branches in game details.",
    category: "advanced",
    type: "boolean",
  },
];
