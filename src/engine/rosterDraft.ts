import { Player, DraftSlot } from "@/types/game";
import { LeagueTier } from "@/types/league";
import { GAME_CONSTANTS } from "./constants";
import { generatePlayer, getRosterSizeByTier } from "./playerGenerator";
import { PlayerQualityTier } from "./statConfig";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";

export interface RosterGap {
  battersNeeded: number;
  startersNeeded: number;
  relieversNeeded: number;
  totalNeeded: number;
}

/**
 * Calculate how many players of each role are needed to meet the target tier's roster size.
 * Compares actual roster composition against the target tier requirements.
 */
export function calculateRosterGap(
  roster: Player[],
  toTier: LeagueTier
): RosterGap {
  const target = getRosterSizeByTier(toTier);

  const currentBatters = roster.filter((p) => p.role === "Batter").length;
  const currentStarters = roster.filter((p) => p.role === "Starter").length;
  const currentRelievers = roster.filter((p) => p.role === "Reliever").length;

  const battersNeeded = Math.max(0, target.batters - currentBatters);
  const startersNeeded = Math.max(0, target.starters - currentStarters);
  const relieversNeeded = Math.max(0, target.relievers - currentRelievers);

  return {
    battersNeeded,
    startersNeeded,
    relieversNeeded,
    totalNeeded: battersNeeded + startersNeeded + relieversNeeded,
  };
}

const TIER_QUALITY_MAP: Record<LeagueTier, PlayerQualityTier> = {
  SANDLOT: "AVERAGE",
  LOCAL: "SOLID",
  REGIONAL: "SOLID",
  NATIONAL: "GOOD",
  WORLD: "GOOD",
};

const QUALITY_ORDER: PlayerQualityTier[] = [
  "ROOKIE",
  "AVERAGE",
  "SOLID",
  "GOOD",
  "STAR",
  "ELITE",
];

function getAdjacentQuality(
  base: PlayerQualityTier,
  direction: -1 | 1
): PlayerQualityTier {
  const idx = QUALITY_ORDER.indexOf(base);
  const newIdx = Math.max(0, Math.min(QUALITY_ORDER.length - 1, idx + direction));
  return QUALITY_ORDER[newIdx];
}

/**
 * Generate draft slots for all needed roster positions.
 * Each slot has 3 candidate players to choose from, with slight quality variation.
 */
export function generateDraftSlots(
  gap: RosterGap,
  toTier: LeagueTier,
  rng: RandomProvider = getDefaultRandomProvider()
): DraftSlot[] {
  const slots: DraftSlot[] = [];
  const baseQuality = TIER_QUALITY_MAP[toTier];

  const addSlots = (
    role: "Batter" | "Starter" | "Reliever",
    count: number
  ) => {
    for (let i = 0; i < count; i++) {
      const candidates: Player[] = [];
      for (let j = 0; j < 3; j++) {
        // Vary quality: ~50% base, ~25% one tier down, ~25% one tier up
        const roll = rng.random();
        let quality = baseQuality;
        if (roll < 0.25) quality = getAdjacentQuality(baseQuality, -1);
        else if (roll < 0.5) quality = getAdjacentQuality(baseQuality, 1);

        candidates.push(generatePlayer(role, quality, rng));
      }
      slots.push({ role, candidates });
    }
  };

  addSlots("Batter", gap.battersNeeded);
  addSlots("Starter", gap.startersNeeded);
  addSlots("Reliever", gap.relieversNeeded);

  return slots;
}
