/**
 * Chemistry Combo System Types — Phase 6
 *
 * When two players with complementary skills are in the lineup together,
 * a Combo can trigger in high-leverage moments. Combos are NOT listed anywhere
 * until discovered (triggered 3x), at which point they are named.
 *
 * See GitHub issues #38, #39.
 */

// ---------------------------------------------------------------------------
// Combo IDs
// ---------------------------------------------------------------------------

export type ChemistryComboId =
  | "the_relay"          // Speed + RBI hit by next batter
  | "power_and_patience" // Walk drawn + Moonshot by cleanup
  | "legacy_lineage"     // Mentor + Apprentice in same lineup
  | "trap_play"          // Bad habit active + opponent misread
  | "one_two_punch"      // Contact + Power consecutive hits → rally
  | "the_shutdown"       // Ice Veins closer + Veteran's Poise starter
  | "old_dog"            // Veteran's Poise age 35+ clutch in inning 9
  | "no_mercy";          // Reinvented player vs former team

// ---------------------------------------------------------------------------
// Discovered Combo (per team/roster)
// ---------------------------------------------------------------------------

export interface DiscoveredCombo {
  discoveryId: string;
  comboId: ChemistryComboId;
  player1Id: string;
  player2Id: string;
  /** Generated at 3rd trigger: "The Martinez-Rivera Effect" */
  generatedName: string;
  timesTriggered: number;
  /** Game number when the combo was named (3rd trigger) */
  namedAt?: number;
  isNamed: boolean;
}

// ---------------------------------------------------------------------------
// Combo Trigger (returned from scanForCombos each at-bat)
// ---------------------------------------------------------------------------

export interface ComboTrigger {
  combo: DiscoveredCombo;
  effectType: ChemistryEffectType;
  magnitude: number; // e.g., 0.5 = +50% to hit probability
  narrative?: string; // only populated once isNamed=true
}

export type ChemistryEffectType =
  | "run_probability_bonus"     // The Relay, Power & Patience
  | "skill_effectiveness_boost" // Legacy Lineage
  | "hr_probability_boost"      // Trap Play, Power & Patience
  | "rally_continuation"        // 1-2 Punch
  | "spirit_boost"              // The Shutdown
  | "morale_boost"              // Old Dog
  | "signature_amplify";        // No Mercy

// ---------------------------------------------------------------------------
// Effect magnitudes
// ---------------------------------------------------------------------------

export const COMBO_EFFECT_MAGNITUDE: Record<ChemistryComboId, number> = {
  the_relay:          0.20,  // +20% run probability
  power_and_patience: 0.50,  // 1.5x HR probability (bonus = 0.50)
  legacy_lineage:     0.10,  // +10% skill effectiveness (110%)
  trap_play:          0.30,  // +30% HR off telegraphed pitch
  one_two_punch:      0.25,  // +25% rally continuation probability
  the_shutdown:       0.20,  // +20% spirit bonus
  old_dog:            0.15,  // +15% morale boost
  no_mercy:           1.00,  // 200% Signature activation (bonus = 1.0 above 100%)
} as const;

/** How many times a combo must trigger before it is named (and becomes visible) */
export const COMBO_DISCOVERY_THRESHOLD = 3;

/** Base probability for an eligible combo to trigger per at-bat */
export const COMBO_BASE_TRIGGER_PROBABILITY = 0.40;
