// src/config/saveConfig.ts

export const SAVE_CONFIG = {
  // Storage keys
  STORAGE_KEY: 'dugout-dynasty-save',
  VERSION_KEY: 'dugout-dynasty-version',

  // Current save version
  CURRENT_VERSION: '1.6.0', // Rename equipment slots to baseball-themed names

  // Auto-save settings
  AUTO_SAVE_ENABLED: true,
  AUTO_SAVE_DEBOUNCE_MS: 500,  // Wait 500ms after last change

  // Validation settings
  VALIDATE_ON_SAVE: true,
  VALIDATE_ON_LOAD: true,

  // Error handling
  RESET_ON_CORRUPT: true,      // Reset to new game if save is corrupt
  BACKUP_ENABLED: false,       // Future: Keep backup of previous save

  // Future: Multi-slot saves
  MAX_SAVE_SLOTS: 1,           // Start with single save slot
} as const;
