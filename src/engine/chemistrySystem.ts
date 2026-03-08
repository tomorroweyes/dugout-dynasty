/**
 * Chemistry Combo System
 *
 * Detects team-level skill synergies when complementary players share a lineup.
 * Combos fire silently for the first 2 triggers, then are named on the 3rd.
 * Once named, they appear on the team's Chemistry Board.
 *
 * 8 defined combos across all Phase 1-5 skill types.
 *
 * See GitHub issues #38, #39.
 */

import type { Player } from "@/types/game";
import type {
  DiscoveredCombo,
  ComboTrigger,
  ChemistryComboId,
  ChemistryEffectType,
} from "@/types/chemistry";
import {
  COMBO_EFFECT_MAGNITUDE,
  COMBO_DISCOVERY_THRESHOLD,
  COMBO_BASE_TRIGGER_PROBABILITY,
} from "@/types/chemistry";
import { hasActiveBadHabit, getActiveHabits } from "./badHabitSystem";
import { getActiveSignatureSkill } from "./signatureSkillSystem";
import { randomChoice } from "./textPools";
import {
  CHEMISTRY_COMBO_FIRES_TEXTS,
  CHEMISTRY_LEGACY_LINEAGE_TEXTS,
  CHEMISTRY_OLD_DOG_TEXTS,
  CHEMISTRY_NO_MERCY_TEXTS,
} from "./narrative/situationalPools";

// ---------------------------------------------------------------------------
// Game Context
// ---------------------------------------------------------------------------

export interface ChemistryGameContext {
  inning: number;
  isCloseGame: boolean;
  scoreDiff: number; // signed: positive = player team leading
  currentGameNumber: number;
  /** RNG function for trigger probability */
  rng?: () => number;
}

// ---------------------------------------------------------------------------
// Combo Definitions
// ---------------------------------------------------------------------------

/**
 * Check whether a pair (p1, p2) qualifies for a specific combo.
 * Returns the ChemistryEffectType if eligible, null otherwise.
 */
type ComboCheck = (
  p1: Player,
  p2: Player,
  context: ChemistryGameContext,
  allLineup: Player[]
) => ChemistryEffectType | null;

const COMBO_CHECKS: Record<ChemistryComboId, ComboCheck> = {
  /** The Relay: p1 fast (speed > 70), p2 has clutch_composure or high contact */
  the_relay: (p1, p2) => {
    const p1Stats = p1.stats as Record<string, number>;
    const p2Stats = p2.stats as Record<string, number>;
    const p1Speed = p1Stats["speed"] ?? 0;
    const p2Power = p2Stats["power"] ?? p2Stats["contact"] ?? 0;
    const p2HasClutch = p2.mentalSkills?.some(
      (s) => s.skillId === "clutch_composure" && s.rank >= 2 && s.isActive
    ) ?? false;

    if (p1Speed > 70 && (p2Power > 70 || p2HasClutch)) {
      return "run_probability_bonus";
    }
    return null;
  },

  /** Power & Patience: p1 has pitch_recognition, p2 has clutch_composure */
  power_and_patience: (p1, p2) => {
    const p1Eye = p1.mentalSkills?.some(
      (s) => s.skillId === "pitch_recognition" && s.rank >= 2 && s.isActive
    ) ?? false;
    const p2Clutch = p2.mentalSkills?.some(
      (s) => s.skillId === "clutch_composure" && s.rank >= 2 && s.isActive
    ) ?? false;

    if (p1Eye && p2Clutch) {
      return "hr_probability_boost";
    }
    return null;
  },

  /** Legacy Lineage: p1 and p2 have active mentorship pair together */
  legacy_lineage: (p1, p2) => {
    const pair = p1.activeMentorship;
    if (
      pair &&
      pair.isActive &&
      ((pair.mentorId === p1.id && pair.apprenticeId === p2.id) ||
        (pair.mentorId === p2.id && pair.apprenticeId === p1.id))
    ) {
      return "skill_effectiveness_boost";
    }
    return null;
  },

  /** Trap Play: p1 has active telegraphed bad habit, p2 has game_reading */
  trap_play: (p1, p2) => {
    const p1Telegraphed = getActiveHabits(p1).some(
      (h) => h.habitType === "telegraphed"
    );
    const p2GameReading = p2.mentalSkills?.some(
      (s) => s.skillId === "game_reading" && s.rank >= 2 && s.isActive
    ) ?? false;

    if (p1Telegraphed && p2GameReading) {
      return "hr_probability_boost";
    }
    return null;
  },

  /** 1-2 Punch: p1 contact archetype (no power trait), p2 power archetype */
  one_two_punch: (p1, p2) => {
    const p1Stats = p1.stats as Record<string, number>;
    const p2Stats = p2.stats as Record<string, number>;
    const p1IsContact = (p1Stats["contact"] ?? 0) > (p1Stats["power"] ?? 0);
    const p2IsPower = (p2Stats["power"] ?? 0) > (p2Stats["contact"] ?? 0);

    if (p1IsContact && p2IsPower) {
      return "rally_continuation";
    }
    return null;
  },

  /** The Shutdown: p1 has ice_veins (closer), p2 has veteran_poise (starter) */
  the_shutdown: (p1, p2) => {
    const p1IceVeins = p1.mentalSkills?.some(
      (s) => s.skillId === "ice_veins" && s.rank >= 3 && s.isActive
    ) ?? false;
    const p2VeteranPoise = p2.mentalSkills?.some(
      (s) => s.skillId === "veteran_poise" && s.rank >= 2 && s.isActive
    ) ?? false;

    if (p1IceVeins && p2VeteranPoise) {
      return "spirit_boost";
    }
    return null;
  },

  /** Old Dog: p1 has veteran_poise AND age >= 35, game is inning 9+ */
  old_dog: (p1, _p2, context) => {
    const hasVetPoise = p1.mentalSkills?.some(
      (s) => s.skillId === "veteran_poise" && s.rank >= 2 && s.isActive
    ) ?? false;
    const isVet = (p1.age ?? 24) >= 35;
    const isLateGame = context.inning >= 9;

    if (hasVetPoise && isVet && isLateGame) {
      return "morale_boost";
    }
    return null;
  },

  /** No Mercy: p1 is reinvented AND has opponentIntel for current opponent */
  no_mercy: (p1, _p2) => {
    const isReinvented = p1.reinventionEvent?.outcome === "success";
    const hasSig = getActiveSignatureSkill(p1) !== null;
    const hasFormerTeamIntel =
      p1.opponentIntel && p1.opponentIntel.length > 0;

    if (isReinvented && hasSig && hasFormerTeamIntel) {
      return "signature_amplify";
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/**
 * Scan all eligible player pairs in the lineup for combo triggers.
 *
 * Returns triggered combos (may be multiple). First 2 triggers are silent;
 * 3rd trigger names the combo and adds narrative.
 *
 * @param lineup           - Active players in the lineup (order matters for 1-2 Punch)
 * @param discoveredCombos - Existing combo records (mutated in place)
 * @param context          - Game context for this AB
 */
export function scanForCombos(
  lineup: Player[],
  discoveredCombos: DiscoveredCombo[],
  context: ChemistryGameContext
): ComboTrigger[] {
  if (!isHighLeverage(context)) {
    return [];
  }

  const rng = context.rng ?? Math.random;
  const triggered: ComboTrigger[] = [];

  const comboIds = Object.keys(COMBO_CHECKS) as ChemistryComboId[];

  for (let i = 0; i < lineup.length; i++) {
    const p1 = lineup[i];

    for (let j = i + 1; j < lineup.length; j++) {
      const p2 = lineup[j];

      for (const comboId of comboIds) {
        const check = COMBO_CHECKS[comboId];
        const effectType = check(p1, p2, context, lineup);

        if (!effectType) continue;

        // RNG gate — 40% base probability
        if (rng() > COMBO_BASE_TRIGGER_PROBABILITY) continue;

        // Find or create the combo record
        const record = getOrCreateCombo(discoveredCombos, comboId, p1, p2);

        // Trigger and build result
        const trigger = triggerCombo(record, context, effectType, p1, p2);
        triggered.push(trigger);
      }
    }
  }

  return triggered;
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

/**
 * Process a single combo trigger.
 * Increments timesTriggered; names the combo on the 3rd trigger.
 */
export function triggerCombo(
  combo: DiscoveredCombo,
  context: ChemistryGameContext,
  effectType: ChemistryEffectType,
  p1: Player,
  p2: Player
): ComboTrigger {
  combo.timesTriggered += 1;

  // Name on discovery threshold
  if (combo.timesTriggered === COMBO_DISCOVERY_THRESHOLD) {
    combo.isNamed = true;
    combo.namedAt = context.currentGameNumber;
    combo.generatedName = generateComboName(p1, p2, combo.comboId);
  }

  const magnitude = COMBO_EFFECT_MAGNITUDE[combo.comboId];
  const narrative = combo.isNamed
    ? buildComboNarrative(combo, p1)
    : undefined;

  return {
    combo,
    effectType,
    magnitude,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

/**
 * Generate a name for a named combo.
 * Prefers "The [Surname1]-[Surname2] Effect" pattern.
 */
export function generateComboName(
  p1: Player,
  p2: Player,
  comboId: ChemistryComboId
): string {
  const s1 = p1.surname || p1.name;
  const s2 = p2.surname || p2.name;

  if (s1 && s2 && s1 !== s2) {
    return `The ${s1}-${s2} Effect`;
  }

  // Fallback: use combo type
  const typeNames: Record<ChemistryComboId, string> = {
    the_relay:          "Relay Combo",
    power_and_patience: "Power & Patience Combo",
    legacy_lineage:     "Lineage Combo",
    trap_play:          "Trap Play Combo",
    one_two_punch:      "1-2 Punch Combo",
    the_shutdown:       "Shutdown Combo",
    old_dog:            "Old Dog Combo",
    no_mercy:           "No Mercy Combo",
  };

  return `The ${typeNames[comboId]}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get or create a DiscoveredCombo record for a pair + combo type */
function getOrCreateCombo(
  store: DiscoveredCombo[],
  comboId: ChemistryComboId,
  p1: Player,
  p2: Player
): DiscoveredCombo {
  const existing = store.find(
    (c) =>
      c.comboId === comboId &&
      ((c.player1Id === p1.id && c.player2Id === p2.id) ||
        (c.player1Id === p2.id && c.player2Id === p1.id))
  );

  if (existing) return existing;

  const fresh: DiscoveredCombo = {
    discoveryId: `combo-${p1.id}-${p2.id}-${comboId}`,
    comboId,
    player1Id: p1.id,
    player2Id: p2.id,
    generatedName: "",
    timesTriggered: 0,
    isNamed: false,
  };

  store.push(fresh);
  return fresh;
}

/** Check high-leverage context for chemistry */
function isHighLeverage(context: ChemistryGameContext): boolean {
  return context.inning >= 7 && context.isCloseGame;
}

/** Build play-by-play narrative for a named combo */
function buildComboNarrative(combo: DiscoveredCombo, p1: Player): string {
  // Combo-specific texts
  if (combo.comboId === "legacy_lineage") {
    return randomChoice(CHEMISTRY_LEGACY_LINEAGE_TEXTS);
  }

  if (combo.comboId === "old_dog") {
    const template = randomChoice(CHEMISTRY_OLD_DOG_TEXTS);
    return template.replace(/{playerName}/g, p1.name);
  }

  if (combo.comboId === "no_mercy") {
    const template = randomChoice(CHEMISTRY_NO_MERCY_TEXTS);
    return template.replace(/{playerName}/g, p1.name);
  }

  // Generic named combo
  const template = randomChoice(CHEMISTRY_COMBO_FIRES_TEXTS);
  return template.replace(/{comboName}/g, combo.generatedName);
}

// ---------------------------------------------------------------------------
// Queries (for Chemistry Board)
// ---------------------------------------------------------------------------

/**
 * Get all named combos (visible on Chemistry Board).
 */
export function getNamedCombos(store: DiscoveredCombo[]): DiscoveredCombo[] {
  return store.filter((c) => c.isNamed);
}

/**
 * Get all unnamed combos (hidden until 3rd trigger).
 */
export function getUnnamedCombos(store: DiscoveredCombo[]): DiscoveredCombo[] {
  return store.filter((c) => !c.isNamed);
}

/**
 * Get the total number of times all named combos have fired.
 */
export function getTotalComboTriggers(store: DiscoveredCombo[]): number {
  return store.reduce((sum, c) => sum + c.timesTriggered, 0);
}
