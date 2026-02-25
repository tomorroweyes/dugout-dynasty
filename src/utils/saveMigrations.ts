// src/utils/saveMigrations.ts

import { SaveData } from '@/types/save';
import { SAVE_CONFIG } from '@/config/saveConfig';
import { LEVEL_CONSTANTS } from '@/engine/xpConfig';
import { ALL_TECHNIQUES } from '@/data/techniques';

type MigrationFunction = (data: SaveData) => SaveData;

/**
 * Migration registry
 * Add new migrations as save format evolves
 */
const MIGRATIONS: Record<string, MigrationFunction> = {
  // v1.0.0 → v1.1.0: Add XP fields to players
  '1.1.0': migrateToV1_1_0,
  // v1.1.0 → v1.2.0: Add equipment fields to players
  '1.2.0': migrateToV1_2_0,
  // v1.2.0 → v1.3.0: Progressive roster system - incompatible with old saves
  // This migration intentionally throws to force reset
  '1.3.0': () => {
    console.warn('Progressive roster system: Old save incompatible, forcing reset');
    throw new Error('ROSTER_SIZE_MIGRATION_RESET');
  },
  // v1.3.0 → v1.4.0: Add traits field to players (synergy system)
  '1.4.0': migrateToV1_4_0,
  // v1.4.0 → v1.5.0: Strip abilities with stale/unknown technique IDs
  '1.5.0': migrateToV1_5_0,
  // v1.5.0 → v1.6.0: Rename equipment slots (mainHand→bat, offHand→glove, head→cap, feet→cleats)
  '1.6.0': migrateToV1_6_0,
};

/**
 * Migration v1.0.0 → v1.1.0
 * Adds XP fields (level, xp, totalXpEarned) to all players
 */
function migrateToV1_1_0(data: SaveData): SaveData {
  const addXpFieldsToPlayer = (player: any) => ({
    ...player,
    level: player.level ?? LEVEL_CONSTANTS.STARTING_LEVEL,
    xp: player.xp ?? LEVEL_CONSTANTS.STARTING_XP,
    totalXpEarned: player.totalXpEarned ?? LEVEL_CONSTANTS.STARTING_XP,
  });

  const migrateRoster = (roster: any[]) => roster.map(addXpFieldsToPlayer);

  return {
    ...data,
    state: {
      ...data.state,
      team: data.state.team
        ? {
            ...data.state.team,
            roster: migrateRoster(data.state.team.roster),
          }
        : null,
      // Also migrate league teams if they have rosters
      league: data.state.league
        ? {
            ...data.state.league,
            teams: data.state.league.teams.map((team: any) => ({
              ...team,
              roster: team.roster ? migrateRoster(team.roster) : team.roster,
            })),
          }
        : null,
    },
  };
}

/**
 * Migration v1.1.0 → v1.2.0
 * Adds equipment fields to all players
 */
function migrateToV1_2_0(data: SaveData): SaveData {
  const addEquipmentFieldsToPlayer = (player: any) => ({
    ...player,
    equipment: player.equipment ?? {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
  });

  const migrateRoster = (roster: any[]) => roster.map(addEquipmentFieldsToPlayer);

  return {
    ...data,
    state: {
      ...data.state,
      team: data.state.team
        ? {
            ...data.state.team,
            roster: migrateRoster(data.state.team.roster),
          }
        : null,
      // Also migrate league teams if they have rosters
      league: data.state.league
        ? {
            ...data.state.league,
            teams: data.state.league.teams.map((team: any) => ({
              ...team,
              roster: team.roster ? migrateRoster(team.roster) : team.roster,
            })),
          }
        : null,
    },
  };
}

/**
 * Migration v1.3.0 → v1.4.0
 * Adds traits field to all players (synergy system)
 * Existing players get traits: [] (no synergy contribution — graceful degradation)
 */
function migrateToV1_4_0(data: SaveData): SaveData {
  const addTraitsToPlayer = (player: any) => ({
    ...player,
    traits: player.traits ?? [],
  });

  const migrateRoster = (roster: any[]) => roster.map(addTraitsToPlayer);

  return {
    ...data,
    state: {
      ...data.state,
      team: data.state.team
        ? {
            ...data.state.team,
            roster: migrateRoster(data.state.team.roster),
          }
        : null,
      league: data.state.league
        ? {
            ...data.state.league,
            teams: data.state.league.teams.map((team: any) => ({
              ...team,
              roster: team.roster ? migrateRoster(team.roster) : team.roster,
            })),
          }
        : null,
    },
  };
}

/**
 * Migration v1.4.0 → v1.5.0
 * Strip abilities with stale/unknown technique IDs from all players.
 * Old technique IDs (e.g. "precision_strike", "patient_eye") were removed
 * when techniques were redesigned; this cleans them out of existing saves.
 */
function migrateToV1_5_0(data: SaveData): SaveData {
  const validIds = new Set(ALL_TECHNIQUES.map((t) => t.id));

  const cleanAbilities = (player: any) => ({
    ...player,
    abilities: Array.isArray(player.abilities)
      ? player.abilities.filter((a: any) => validIds.has(a.abilityId))
      : [],
  });

  const migrateRoster = (roster: any[]) => roster.map(cleanAbilities);

  return {
    ...data,
    state: {
      ...data.state,
      team: data.state.team
        ? {
            ...data.state.team,
            roster: migrateRoster(data.state.team.roster),
          }
        : null,
      league: data.state.league
        ? {
            ...data.state.league,
            teams: data.state.league.teams.map((team: any) => ({
              ...team,
              roster: team.roster ? migrateRoster(team.roster) : team.roster,
            })),
          }
        : null,
    },
  };
}

/**
 * Run all necessary migrations to bring save data to current version
 * Pure function - returns new object
 */
export function migrateSaveData(data: SaveData): SaveData {
  let migratedData = { ...data };
  const currentVersion = SAVE_CONFIG.CURRENT_VERSION;

  // If save is already current version, no migration needed
  if (migratedData.version === currentVersion) {
    return migratedData;
  }

  console.log(`Migrating save from ${migratedData.version} to ${currentVersion}`);

  // Apply migrations in order
  const versions = Object.keys(MIGRATIONS).sort();
  for (const targetVersion of versions) {
    // Only apply migrations newer than current save version
    if (isVersionNewer(targetVersion, migratedData.version)) {
      console.log(`  Applying migration to ${targetVersion}`);
      migratedData = MIGRATIONS[targetVersion](migratedData);
      migratedData.version = targetVersion;
    }

    // Stop when we reach current version
    if (targetVersion === currentVersion) {
      break;
    }
  }

  // Update to current version
  migratedData.version = currentVersion;
  migratedData.timestamp = Date.now();

  return migratedData;
}

/**
 * Check if version A is newer than version B
 * Uses semantic versioning comparison
 */
function isVersionNewer(versionA: string, versionB: string): boolean {
  const [majorA, minorA, patchA] = versionA.split('.').map(Number);
  const [majorB, minorB, patchB] = versionB.split('.').map(Number);

  if (majorA !== majorB) return majorA > majorB;
  if (minorA !== minorB) return minorA > minorB;
  return patchA > patchB;
}

/**
 * Migration v1.5.0 → v1.6.0
 * Renames equipment slot keys to baseball-themed names:
 *   mainHand → bat, offHand → glove, head → cap, feet → cleats
 */
function migrateToV1_6_0(data: SaveData): SaveData {
  const renameEquipmentSlots = (player: any) => {
    if (!player.equipment) return player;
    const { mainHand, offHand, head, feet, accessory, ...rest } = player.equipment;
    return {
      ...player,
      equipment: {
        bat: mainHand ?? null,
        glove: offHand ?? null,
        cap: head ?? null,
        cleats: feet ?? null,
        accessory: accessory ?? null,
        ...rest,
      },
    };
  };

  const migrateRoster = (roster: any[]) => roster.map(renameEquipmentSlots);

  return {
    ...data,
    state: {
      ...data.state,
      team: data.state.team
        ? {
            ...data.state.team,
            roster: migrateRoster(data.state.team.roster),
          }
        : null,
      league: data.state.league
        ? {
            ...data.state.league,
            teams: data.state.league.teams.map((team: any) => ({
              ...team,
              roster: team.roster ? migrateRoster(team.roster) : team.roster,
            })),
          }
        : null,
    },
  };
}

// =============================================================================
// Example Future Migrations
// =============================================================================

/**
 * Example migration v1.0.0 → v1.1.0
 * Adds new 'morale' field to Team
 */
// function migrateToV1_1_0(data: SaveData): SaveData {
//   return {
//     ...data,
//     state: {
//       ...data.state,
//       team: data.state.team
//         ? {
//             ...data.state.team,
//             morale: 50, // Add default morale
//           }
//         : null,
//     },
//   };
// }

/**
 * Example migration v1.1.0 → v1.2.0
 * Converts salary from number to { base: number, bonus: number }
 */
// function migrateToV1_2_0(data: SaveData): SaveData {
//   return {
//     ...data,
//     state: {
//       ...data.state,
//       team: data.state.team
//         ? {
//             ...data.state.team,
//             roster: data.state.team.roster.map(player => ({
//               ...player,
//               salary: {
//                 base: player.salary, // Old single number → base
//                 bonus: 0,            // Add new bonus field
//               },
//             })),
//           }
//         : null,
//     },
//   };
// }
