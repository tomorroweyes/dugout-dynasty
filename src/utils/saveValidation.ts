// src/utils/saveValidation.ts

import { SaveData, isSaveData } from '@/types/save';
import { Team, Player, isBatter, isPitcher } from '@/types/game';
import { SAVE_CONFIG } from '@/config/saveConfig';

/**
 * Validates save data structure and content
 * Pure function - no side effects
 */
export function validateSaveData(data: unknown): {
  valid: boolean;
  error?: string;
  data?: SaveData;
} {
  // Type guard check
  if (!isSaveData(data)) {
    return {
      valid: false,
      error: 'Invalid save data structure',
    };
  }

  // Version compatibility check
  if (!isVersionCompatible(data.version)) {
    return {
      valid: false,
      error: `Incompatible save version: ${data.version}`,
    };
  }

  // Validate team data if present
  if (data.state.team) {
    const teamValidation = validateTeam(data.state.team);
    if (!teamValidation.valid) {
      return {
        valid: false,
        error: `Team validation failed: ${teamValidation.error}`,
      };
    }
  }

  return { valid: true, data };
}

/**
 * Check if save version is compatible with current game version
 */
function isVersionCompatible(saveVersion: string): boolean {
  const [saveMajor] = saveVersion.split('.').map(Number);
  const [currentMajor] = SAVE_CONFIG.CURRENT_VERSION.split('.').map(Number);

  // Same major version = compatible
  // Different major version = incompatible (breaking changes)
  return saveMajor === currentMajor;
}

/**
 * Validate team structure and data integrity
 */
function validateTeam(team: Team): { valid: boolean; error?: string } {
  // Check required fields exist
  if (typeof team.cash !== 'number' || team.cash < 0) {
    return { valid: false, error: 'Invalid cash value' };
  }

  if (typeof team.fans !== 'number' || team.fans < 0) {
    return { valid: false, error: 'Invalid fans value' };
  }

  if (!Array.isArray(team.roster) || team.roster.length === 0) {
    return { valid: false, error: 'Invalid roster' };
  }

  // Validate each player
  for (const player of team.roster) {
    const playerValidation = validatePlayer(player);
    if (!playerValidation.valid) {
      return { valid: false, error: `Player ${player.name}: ${playerValidation.error}` };
    }
  }

  // Validate lineup references
  const rosterIds = new Set(team.roster.map(p => p.id));

  for (const id of team.lineup) {
    if (!rosterIds.has(id)) {
      return { valid: false, error: `Lineup references non-existent player: ${id}` };
    }
  }

  return { valid: true };
}

/**
 * Validate individual player data
 */
function validatePlayer(player: Player): { valid: boolean; error?: string } {
  // Check ID
  if (typeof player.id !== 'string' || player.id.length === 0) {
    return { valid: false, error: 'Invalid player ID' };
  }

  // Check name
  if (typeof player.name !== 'string' || player.name.length === 0) {
    return { valid: false, error: 'Invalid player name' };
  }

  // Check role
  if (!['Batter', 'Starter', 'Reliever'].includes(player.role)) {
    return { valid: false, error: `Invalid role: ${player.role}` };
  }

  // Check stats match role
  if (isBatter(player)) {
    const stats = player.stats;
    if (
      typeof stats.power !== 'number' ||
      typeof stats.contact !== 'number' ||
      typeof stats.glove !== 'number'
    ) {
      return { valid: false, error: 'Invalid batter stats' };
    }
  } else if (isPitcher(player)) {
    const stats = player.stats;
    if (
      typeof stats.velocity !== 'number' ||
      typeof stats.control !== 'number' ||
      typeof stats.break !== 'number'
    ) {
      return { valid: false, error: 'Invalid pitcher stats' };
    }
  }

  // Check salary
  if (typeof player.salary !== 'number' || player.salary < 0) {
    return { valid: false, error: 'Invalid salary' };
  }

  return { valid: true };
}

/**
 * Sanitize loaded data (clamp values to valid ranges)
 * Pure function - returns new object
 */
export function sanitizeSaveData(data: SaveData): SaveData {
  if (!data.state.team) return data;

  return {
    ...data,
    state: {
      ...data.state,
      team: {
        ...data.state.team,
        cash: Math.max(0, data.state.team.cash),
        fans: Math.max(0, data.state.team.fans),
        wins: Math.max(0, data.state.team.wins),
        losses: Math.max(0, data.state.team.losses),
        roster: data.state.team.roster.map(player => ({
          ...player,
          salary: Math.max(0, player.salary),
        })),
      },
    },
  };
}
