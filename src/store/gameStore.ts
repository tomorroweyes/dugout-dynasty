import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Team, Player, DraftState } from "@/types/game";
import { SaveData, MatchLogEntry } from "@/types/save";
import { League, LeagueTier, CareerStats } from "@/types/league";
import { gameController } from "@/services/GameController";
import { leagueController } from "@/services/LeagueController";
import { GAME_CONSTANTS } from "@/engine/constants";
import { SAVE_CONFIG } from "@/config/saveConfig";
import { validateSaveData, sanitizeSaveData } from "@/utils/saveValidation";
import { migrateSaveData } from "@/utils/saveMigrations";
import { useSettingsStore } from "./settingsStore";
import { applyXpToPlayer, type LevelUpResult } from "@/engine/xpSystem";
import { EquipmentSlot } from "@/types/item";
import { useInventoryStore } from "./inventoryStore";
import { useShopStore } from "./shopStore";
import { PlayerClass } from "@/types/ability";
import {
  unlockAbility as unlockAbilityFn,
  upgradeAbility as upgradeAbilityFn,
  regenerateSpirit,
} from "@/engine/abilitySystem";
import { selectClass as selectClassFn } from "@/engine/classSelection";
import { accumulateMatchStats, resetSeasonStats } from "@/engine/statAccumulation";
import { calculateRosterGap, generateDraftSlots } from "@/engine/rosterDraft";
import type { InteractiveMatchState } from "@/engine/interactiveMatchEngine";
import { SeededRandomProvider } from "@/engine/randomProvider";

interface GameState {
  // Core state
  team: Team | null;
  matchLog: MatchLogEntry[];
  league: League | null;
  currentTier: LeagueTier;
  career: CareerStats;
  pendingLevelUps: LevelUpResult[]; // Level-ups to show in UI
  pendingDraft: DraftState | null; // Draft state during tier promotion
  activeInteractiveMatch: InteractiveMatchState | null; // Persisted interactive match

  // Actions
  initializeGame: () => void;
  playWeekMatch: () => void;
  completeWeek: () => void;
  advanceToNextSeason: () => void;
  pickDraftPlayer: (player: Player) => void;
  completeDraft: () => void;
  swapPlayers: (playerId: string) => void;
  autoFix: () => void;
  resetGame: () => void;
  clearPendingLevelUps: () => void;
  setActiveInteractiveMatch: (match: InteractiveMatchState | null) => void;

  // Equipment actions (Phase 2)
  equipItem: (playerId: string, itemId: string) => void;
  unequipItem: (playerId: string, slot: EquipmentSlot) => void;

  // Ability actions (Phase 4)
  selectClass: (playerId: string, playerClass: string) => void;
  unlockAbility: (playerId: string, abilityId: string) => void;
  upgradeAbility: (playerId: string, abilityId: string) => void;

  // Legacy actions (kept for backwards compatibility during transition)
  generateTeam: () => void;
  playMatch: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      team: null,
      matchLog: [],
      league: null,
      currentTier: "SANDLOT",
      career: {
        totalSeasons: 0,
        totalWins: 0,
        totalLosses: 0,
        championshipsWon: 0,
        tournamentsWon: 0,
        highestTierReached: "SANDLOT",
        historicalRecords: [],
      },
      pendingLevelUps: [],
      pendingDraft: null,
      activeInteractiveMatch: null,

      /**
       * Initialize new game - create team and first league
       */
      initializeGame: () => {
        const { roster, lineup } = gameController.generateNewTeam("SANDLOT");

        const team: Team = {
          id: `team-${Date.now()}`,
          cash: GAME_CONSTANTS.STARTING_CASH,
          fans: GAME_CONSTANTS.STARTING_FANS,
          roster,
          lineup,
          wins: 0,
          losses: 0,
          colors: {
            primary: "#1E40AF", // Blue - default human team color
            secondary: "#DBEAFE",
          },
        };

        // Start in Sandlot tier
        const league = leagueController.startNewSeason("SANDLOT", team, 1);

        set({
          team,
          league,
          currentTier: "SANDLOT",
          matchLog: [],
          career: {
            totalSeasons: 1,
            totalWins: 0,
            totalLosses: 0,
            championshipsWon: 0,
            tournamentsWon: 0,
            highestTierReached: "SANDLOT",
            historicalRecords: [],
          },
        });
      },

      /**
       * Play this week's match against scheduled opponent
       */
      playWeekMatch: () => {
        const { team, league } = get();
        if (!team || !league) return;

        // Find this week's match
        const currentWeek = league.schedule.weeks[league.currentWeek];
        if (!currentWeek) return;

        const myMatch = currentWeek.matches.find(
          (m) =>
            m.homeTeamId === league.humanTeamId ||
            m.awayTeamId === league.humanTeamId
        );

        if (!myMatch || myMatch.completed) return;

        // Get opponent team
        const opponentId =
          myMatch.homeTeamId === league.humanTeamId
            ? myMatch.awayTeamId
            : myMatch.homeTeamId;
        const opponentTeam = league.teams.find((t) => t.id === opponentId);

        if (!opponentTeam) return;

        // Play match against the actual league opponent, using tier-specific match rewards
        const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[league.tier];
        const { result, xpGains } = gameController.playMatch(team, {
          opponentTeam,
          seed: undefined,
          enableTrace: useSettingsStore.getState().enableEngineTrace,
          matchRewards: tierConfig.matchRewards,
        });

        // Apply XP to all players, regenerate spirit, and collect level-ups
        const allLevelUps: LevelUpResult[] = [];
        let updatedRoster = team.roster.map((player) => {
          let updatedPlayer = player;

          // Apply XP if player earned any
          const xpGain = xpGains.find((g) => g.playerId === player.id);
          if (xpGain) {
            const result = applyXpToPlayer(player, xpGain.xpEarned);
            updatedPlayer = result.updatedPlayer;
            allLevelUps.push(...result.levelUps);
          }

          // Always regenerate spirit after match for players with a class
          // (even bench players who didn't earn XP need spirit restored)
          return updatedPlayer.class ? regenerateSpirit(updatedPlayer) : updatedPlayer;
        });

        // Accumulate season/career stats from BoxScore for both teams
        let updatedOpponentRoster = opponentTeam.roster;
        if (result.boxScore) {
          const accumulated = accumulateMatchStats(updatedRoster, opponentTeam.roster, result.boxScore);
          updatedRoster = accumulated.homeRoster;
          updatedOpponentRoster = accumulated.awayRoster;
        }

        // Create team with updated XP and record
        let updatedTeam: Team = {
          ...team,
          cash: team.cash + result.cashEarned,
          wins: team.wins + (result.isWin ? 1 : 0),
          losses: team.losses + (result.isWin ? 0 : 1),
          roster: updatedRoster,
        };

        // Apply auto-rotation if enabled
        const settings = useSettingsStore.getState();
        if (settings.autoRotatePitchers) {
          const rotationResult = gameController.autoRotatePitchers(updatedTeam);
          if (rotationResult) {
            updatedTeam = {
              ...updatedTeam,
              lineup: rotationResult.lineup,
            };
          }
        }

        // Mark match as complete
        myMatch.completed = true;
        myMatch.result = result;

        // Update league teams array with updated human team and opponent stats
        const updatedLeagueTeams = league.teams.map((t) => {
          if (t.id === league.humanTeamId) {
            return { ...t, roster: updatedTeam.roster, wins: updatedTeam.wins, losses: updatedTeam.losses };
          }
          if (t.id === opponentId) {
            return { ...t, roster: updatedOpponentRoster };
          }
          return t;
        });

        set({
          team: updatedTeam,
          league: {
            ...league,
            teams: updatedLeagueTeams,
          },
          matchLog: [
            {
              ...result,
              timestamp: Date.now(),
              opponent: opponentTeam.name,
            },
            ...get().matchLog,
          ].slice(0, 200),
          pendingLevelUps: allLevelUps,
        });

        // Refresh shop stock after each match
        useShopStore.getState().refreshStock(updatedTeam.roster);
      },

      /**
       * After playing your match, simulate rest of week and advance
       */
      completeWeek: () => {
        const { league, career } = get();
        if (!league) return;

        // Simulate all AI vs AI matches
        const updatedLeague = leagueController.completeWeek(league);

        // Check if season ended
        if (updatedLeague.isComplete && updatedLeague.seasonResult) {
          const { team } = get();
          if (!team) return;

          // Apply season rewards to team
          const rewardedTeam: Team = {
            ...team,
            cash: team.cash + updatedLeague.seasonResult.cashPrize,
            fans: team.fans + updatedLeague.seasonResult.fanBonus,
          };

          // Update career stats
          const updatedCareer: CareerStats = {
            ...career,
            totalWins: career.totalWins + updatedLeague.seasonResult.totalWins,
            totalLosses: career.totalLosses + updatedLeague.seasonResult.totalLosses,
            championshipsWon:
              updatedLeague.seasonResult.finalPosition === 1
                ? career.championshipsWon + 1
                : career.championshipsWon,
            historicalRecords: career.historicalRecords,
          };

          set({
            team: rewardedTeam,
            league: updatedLeague,
            career: updatedCareer,
          });
        } else {
          set({ league: updatedLeague });
        }
      },

      /**
       * Start next season (after viewing results screen)
       * Handles promotion (triggers draft) and demotion (auto-shrinks lineup)
       */
      advanceToNextSeason: () => {
        const { league, team, career } = get();
        if (!league || !team || !league.seasonResult) return;

        const nextTier = league.seasonResult.nextTier || league.tier;
        const currentTier = league.tier;

        // Check if roster needs expansion (promotion)
        const gap = calculateRosterGap(team.roster, nextTier);

        if (gap.totalNeeded > 0) {
          // Generate draft candidates and pause for player picks
          const slots = generateDraftSlots(gap, nextTier);
          set({
            pendingDraft: {
              fromTier: currentTier,
              toTier: nextTier,
              slots,
              picks: [],
              currentSlotIndex: 0,
            },
          });
          return; // Don't start new season yet — wait for draft completion
        }

        // No expansion needed — start new season (handles same-tier and demotion)
        const resetTeam: Team = {
          ...team,
          wins: 0,
          losses: 0,
          roster: team.roster.map(resetSeasonStats),
        };

        // For demotion, auto-fix lineup to fit smaller tier
        const fixedLineup = gameController.autoFix(resetTeam);
        const finalTeam = fixedLineup
          ? { ...resetTeam, lineup: fixedLineup.lineup }
          : resetTeam;

        const newLeague = leagueController.startNewSeason(
          nextTier,
          finalTeam,
          league.season + 1
        );

        const updatedCareer: CareerStats = {
          ...career,
          totalSeasons: career.totalSeasons + 1,
          highestTierReached:
            leagueController.getTierPriority(nextTier) >
            leagueController.getTierPriority(career.highestTierReached)
              ? nextTier
              : career.highestTierReached,
        };

        set({
          team: finalTeam,
          league: newLeague,
          currentTier: nextTier,
          career: updatedCareer,
        });
      },

      /**
       * Pick a player during the promotion draft
       */
      pickDraftPlayer: (player: Player) => {
        const { pendingDraft } = get();
        if (!pendingDraft) return;

        const newPicks = [...pendingDraft.picks, player];
        const nextIndex = pendingDraft.currentSlotIndex + 1;

        // If all slots filled, auto-complete the draft
        if (nextIndex >= pendingDraft.slots.length) {
          set({
            pendingDraft: {
              ...pendingDraft,
              picks: newPicks,
              currentSlotIndex: nextIndex,
            },
          });
          // Trigger completion
          get().completeDraft();
          return;
        }

        set({
          pendingDraft: {
            ...pendingDraft,
            picks: newPicks,
            currentSlotIndex: nextIndex,
          },
        });
      },

      /**
       * Complete the draft: add picked players to roster and start new season
       */
      completeDraft: () => {
        const { pendingDraft, team, league, career } = get();
        if (!pendingDraft || !team || !league) return;

        // Add drafted players to roster
        const expandedRoster = [
          ...team.roster.map(resetSeasonStats),
          ...pendingDraft.picks,
        ];

        const resetTeam: Team = {
          ...team,
          wins: 0,
          losses: 0,
          roster: expandedRoster,
        };

        // Auto-fix lineup with expanded roster
        const fixedLineup = gameController.autoFix(resetTeam);
        const finalTeam = fixedLineup
          ? { ...resetTeam, lineup: fixedLineup.lineup }
          : resetTeam;

        const newLeague = leagueController.startNewSeason(
          pendingDraft.toTier,
          finalTeam,
          league.season + 1
        );

        const updatedCareer: CareerStats = {
          ...career,
          totalSeasons: career.totalSeasons + 1,
          highestTierReached:
            leagueController.getTierPriority(pendingDraft.toTier) >
            leagueController.getTierPriority(career.highestTierReached)
              ? pendingDraft.toTier
              : career.highestTierReached,
        };

        set({
          team: finalTeam,
          league: newLeague,
          currentTier: pendingDraft.toTier,
          career: updatedCareer,
          pendingDraft: null,
        });
      },

      swapPlayers: (playerId: string) => {
        const { team } = get();
        if (!team) return;

        // Use GameController to validate and execute swap
        const result = gameController.swapPlayer(team, playerId);

        if (result) {
          set({
            team: {
              ...team,
              lineup: result.lineup,
            },
          });
        }
      },

      autoFix: () => {
        const { team } = get();
        if (!team) return;

        // Use GameController to auto-fix lineup with best players
        const result = gameController.autoFix(team);

        if (result) {
          set({
            team: {
              ...team,
              lineup: result.lineup,
            },
          });
        }
      },

      clearPendingLevelUps: () => {
        set({ pendingLevelUps: [] });
      },

      setActiveInteractiveMatch: (match) => {
        set({ activeInteractiveMatch: match });
      },

      /**
       * Equip an item to a player
       * Removes item from inventory and equips it
       * If a slot is already occupied, unequips the old item first
       */
      equipItem: (playerId: string, itemId: string) => {
        const { team } = get();
        if (!team) return;

        // Get item from inventory
        const item = useInventoryStore.getState().getItemById(itemId);
        if (!item) return;

        // Find the player
        const playerIndex = team.roster.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return;

        const player = team.roster[playerIndex];

        // Check if slot is occupied
        const currentItem = player.equipment[item.slot];
        if (currentItem) {
          // Unequip current item first (send back to inventory)
          useInventoryStore.getState().addItem(currentItem);
        }

        // Equip new item
        const updatedRoster = [...team.roster];
        updatedRoster[playerIndex] = {
          ...player,
          equipment: {
            ...player.equipment,
            [item.slot]: item,
          },
        };

        // Update team roster first so equipment shows before inventory clears
        set({
          team: {
            ...team,
            roster: updatedRoster,
          },
        });

        // Remove item from inventory
        useInventoryStore.getState().removeItem(itemId);
      },

      /**
       * Unequip an item from a player
       * Returns item to inventory
       */
      unequipItem: (playerId: string, slot: EquipmentSlot) => {
        const { team } = get();
        if (!team) return;

        // Find the player
        const playerIndex = team.roster.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return;

        const player = team.roster[playerIndex];
        const item = player.equipment[slot];

        if (!item) return; // Slot is empty

        // Add item back to inventory
        const added = useInventoryStore.getState().addItem(item);
        if (!added) {
          // Inventory full - can't unequip
          console.warn("Cannot unequip item: inventory is full");
          return;
        }

        // Unequip item
        const updatedRoster = [...team.roster];
        updatedRoster[playerIndex] = {
          ...player,
          equipment: {
            ...player.equipment,
            [slot]: null,
          },
        };

        // Update team roster
        set({
          team: {
            ...team,
            roster: updatedRoster,
          },
        });
      },

      /**
       * Select class for a player (at level 1+)
       * Initializes spirit resource and sets class
       */
      selectClass: (playerId: string, playerClass: string) => {
        const { team } = get();
        if (!team) return;

        // Find the player
        const playerIndex = team.roster.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return;

        const player = team.roster[playerIndex];

        // Use engine function to select class (handles validation and initialization)
        const updatedPlayer = selectClassFn(player, playerClass as PlayerClass);

        // If player wasn't updated (validation failed), return early
        if (updatedPlayer === player) return;

        // Update roster with the new player data
        const updatedRoster = [...team.roster];
        updatedRoster[playerIndex] = updatedPlayer;

        // Update team roster
        set({
          team: {
            ...team,
            roster: updatedRoster,
          },
        });
      },

      /**
       * Unlock an ability for a player
       * Costs 1 skill point
       */
      unlockAbility: (playerId: string, abilityId: string) => {
        const { team } = get();
        if (!team) return;

        // Find the player
        const playerIndex = team.roster.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return;

        const player = team.roster[playerIndex];

        // Unlock ability (returns updated player or same player if can't unlock)
        const updatedPlayer = unlockAbilityFn(player, abilityId);

        // Only update if player changed
        if (updatedPlayer !== player) {
          const updatedRoster = [...team.roster];
          updatedRoster[playerIndex] = updatedPlayer;

          set({
            team: {
              ...team,
              roster: updatedRoster,
            },
          });
        }
      },

      /**
       * Upgrade an ability to the next rank
       * Costs 1 skill point
       */
      upgradeAbility: (playerId: string, abilityId: string) => {
        const { team } = get();
        if (!team) return;

        // Find the player
        const playerIndex = team.roster.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return;

        const player = team.roster[playerIndex];

        // Upgrade ability (returns updated player or same player if can't upgrade)
        const updatedPlayer = upgradeAbilityFn(player, abilityId);

        // Only update if player changed
        if (updatedPlayer !== player) {
          const updatedRoster = [...team.roster];
          updatedRoster[playerIndex] = updatedPlayer;

          set({
            team: {
              ...team,
              roster: updatedRoster,
            },
          });
        }
      },

      resetGame: () => {
        // Clear localStorage
        localStorage.removeItem(SAVE_CONFIG.STORAGE_KEY);

        // Reset inventory
        useInventoryStore.getState().resetInventory();

        // Reset state
        set({
          team: null,
          matchLog: [],
          league: null,
          currentTier: "SANDLOT",
          career: {
            totalSeasons: 0,
            totalWins: 0,
            totalLosses: 0,
            championshipsWon: 0,
            tournamentsWon: 0,
            highestTierReached: "SANDLOT",
            historicalRecords: [],
          },
          pendingLevelUps: [],
          pendingDraft: null,
          activeInteractiveMatch: null,
        });

        // Initialize new game
        get().initializeGame();
      },

      /**
       * Legacy actions - kept for backwards compatibility
       * Use initializeGame() and playWeekMatch() for new code
       */
      generateTeam: () => {
        get().initializeGame();
      },

      playMatch: () => {
        // In league mode, use playWeekMatch which plays against league opponents
        // This ensures we don't accidentally generate random opponents
        get().playWeekMatch();
      },
    }),
    {
      name: SAVE_CONFIG.STORAGE_KEY,
      version: 2, // Bumped for league system

      // Migration function for old saves
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Old save format: { team, matchLog }
          // New format: { team, matchLog, league, currentTier, career }

          // If team exists, create a league for it
          if (persistedState.team) {
            // Ensure team has an ID (old saves don't have IDs)
            const teamWithId = {
              ...persistedState.team,
              id: persistedState.team.id || `team-${Date.now()}`,
            };

            const league = leagueController.startNewSeason(
              "SANDLOT",
              teamWithId,
              1
            );

            return {
              ...persistedState,
              team: teamWithId,
              league,
              currentTier: "SANDLOT",
              career: {
                totalSeasons: 1,
                totalWins: teamWithId.wins || 0,
                totalLosses: teamWithId.losses || 0,
                championshipsWon: 0,
                tournamentsWon: 0,
                highestTierReached: "SANDLOT",
                historicalRecords: [],
              },
            };
          }
        }

        // Return state as-is if no migration needed
        return persistedState;
      },

      // Custom storage with validation
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          try {
            const rawData = localStorage.getItem(name);
            if (!rawData) return null;

            const parsed = JSON.parse(rawData);

            // Validate loaded data
            if (SAVE_CONFIG.VALIDATE_ON_LOAD) {
              const validation = validateSaveData(parsed.state);

              if (!validation.valid) {
                console.error(`Save validation failed: ${validation.error}`);

                if (SAVE_CONFIG.RESET_ON_CORRUPT) {
                  console.warn("Resetting to new game due to corrupt save");
                  localStorage.removeItem(name);
                  return null;
                }

                throw new Error(`Corrupt save data: ${validation.error}`);
              }

              // Run migrations if needed
              if (
                validation.data &&
                validation.data.version !== SAVE_CONFIG.CURRENT_VERSION
              ) {
                const migratedData = migrateSaveData(validation.data);
                const sanitizedData = sanitizeSaveData(migratedData);

                // Return migrated data wrapped in Zustand persist format
                return JSON.stringify({
                  state: sanitizedData.state,
                  version: 2, // Current version after migration
                });
              }

              // Sanitize data (clamp values)
              if (validation.data) {
                const sanitizedData = sanitizeSaveData(validation.data);
                return JSON.stringify({
                  state: sanitizedData.state,
                  version: 2, // Current version
                });
              }
            }

            return rawData;
          } catch (error) {
            console.error("Error loading save data:", error);

            if (SAVE_CONFIG.RESET_ON_CORRUPT) {
              localStorage.removeItem(name);
              return null;
            }

            throw error;
          }
        },

        setItem: (name: string, value: string) => {
          try {
            const parsed = JSON.parse(value);

            // Wrap Zustand state in save format
            const saveData: SaveData = {
              version: SAVE_CONFIG.CURRENT_VERSION,
              timestamp: Date.now(),
              gameVersion: "0.0.1", // From package.json
              state: parsed.state,
            };

            // Validate before saving
            if (SAVE_CONFIG.VALIDATE_ON_SAVE) {
              const validation = validateSaveData(saveData);

              if (!validation.valid) {
                console.error(`Cannot save: ${validation.error}`);
                throw new Error(`Invalid save data: ${validation.error}`);
              }
            }

            // Save with metadata
            localStorage.setItem(
              name,
              JSON.stringify({
                state: saveData,
                version: 1,
              })
            );
          } catch (error) {
            console.error("Error saving data:", error);
            throw error;
          }
        },

        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      })),

      // Rehydrate non-serializable fields after loading from localStorage
      onRehydrateStorage: () => (state) => {
        if (state?.activeInteractiveMatch?.rng) {
          // rng was serialized as a plain object with a seed property.
          // Reconstruct a SeededRandomProvider and restore its internal seed
          // without re-hashing (setSeed hashes, so we set the property directly).
          const savedSeed = (state.activeInteractiveMatch.rng as any).seed;
          if (typeof savedSeed === "number") {
            const rng = new SeededRandomProvider(0);
            // Bypass the hashing in constructor/setSeed by writing directly
            (rng as any).seed = savedSeed;
            state.activeInteractiveMatch.rng = rng;
          }
          // Drop non-serializable trace collector
          delete (state.activeInteractiveMatch as any).trace;
        }
      },

      // Partial state persistence (exclude derived state if any)
      partialize: (state) => ({
        team: state.team,
        matchLog: state.matchLog,
        league: state.league,
        currentTier: state.currentTier,
        career: state.career,
        pendingDraft: state.pendingDraft,
        activeInteractiveMatch: state.activeInteractiveMatch,
      }),
    }
  )
);

// Dev debug tool: simulate tier changes without playing through a season
if (import.meta.env.DEV) {
  (window as any).__dev = {
    simulateTierChange: (targetTier: LeagueTier) => {
      const state = useGameStore.getState();
      if (!state.league || !state.team) {
        console.error("No active game. Start a game first.");
        return;
      }

      const currentTier = state.league.tier;
      const promoted =
        leagueController.getTierPriority(targetTier) >
        leagueController.getTierPriority(currentTier);
      const relegated =
        leagueController.getTierPriority(targetTier) <
        leagueController.getTierPriority(currentTier);

      useGameStore.setState({
        league: {
          ...state.league,
          isComplete: true,
          seasonResult: {
            finalPosition: promoted ? 1 : relegated ? 6 : 3,
            totalWins: state.team.wins,
            totalLosses: state.team.losses,
            cashPrize: 500,
            scoutPoints: 1,
            fanBonus: 0.05,
            promoted,
            relegated,
            nextTier: targetTier,
          },
        },
      });

      console.log(
        `Simulated ${promoted ? "promotion" : relegated ? "relegation" : "lateral move"} to ${targetTier}. Season results screen should now appear.`
      );
    },
  };
}
