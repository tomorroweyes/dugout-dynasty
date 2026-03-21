/**
 * Scoring configuration — all numeric constants for evaluation, scoring, and context.
 *
 * Why this exists: data.ts and advice.ts previously contained ~189 inline literals.
 * Centralising them here means tuning a weight or threshold is a one-line change,
 * and the numbers are self-documenting through their names.
 */

// ─── Tier boundaries ──────────────────────────────────────────────────────────
// Composite percentile score (0–1) → display tier (scoreToTier)
export const TIER_THRESHOLDS = {
  ELITE: 0.80,
  T1:    0.66,
  T2:    0.50,
  T3:    0.35,
  T4:    0.20,
} as const;

// ─── Batter scoring weights ───────────────────────────────────────────────────
// H2H most-categories: each category is one matchup line, so weights are near-equal.
// H is slightly below the other counting stats because it overlaps with R and OPS.
export const BATTER_WEIGHTS = {
  OPS: 0.20,
  HR:  0.18,
  R:   0.16,
  RBI: 0.16,
  SB:  0.16,
  H:   0.14,
} as const;

// ─── Pitcher scoring weights ──────────────────────────────────────────────────
// SP tier composite (blended 50/50 actuals + projections)
export const SP_TIER_WEIGHTS = {
  K:    0.28,
  ERA:  0.22,
  WHIP: 0.22,
  QS:   0.20,
  PA:   0.08, // durability proxy, not a scoring category
} as const;

// SP draft score (projections-first)
export const SP_DRAFT_WEIGHTS = {
  K:    0.28,
  ERA:  0.24,
  WHIP: 0.24,
  QS:   0.24,
} as const;

// RP weights (SVHD dominates; closers' ~65 IP barely moves ERA/WHIP vs. SP volume)
export const RP_WEIGHTS = {
  SVHD: 0.55,
  ERA:  0.20,
  WHIP: 0.20,
  K:    0.05,
} as const;

// ─── Age penalties ────────────────────────────────────────────────────────────
// Deducted from draftScore. Pitchers age slightly faster than hitters in the model.
export const BATTER_AGE_PENALTIES = {
  age_33_34: 3,
  age_35_36: 8,
  age_37_plus: 15,
} as const;

export const PITCHER_AGE_PENALTIES = {
  age_33_34: 2,
  age_35_36: 7,
  age_37_plus: 12,
} as const;

// ─── Injury penalties ─────────────────────────────────────────────────────────
// In H2H categories a multi-month absence = dead active roster slot every matchup week.
export const INJURY_PENALTIES = {
  unknown:        22, // Status missing — assume significant
  day_to_day:      8,
  il_10_or_15:    15, // Short IL, limited matchup impact
  il_60:          45, // 2+ months of dead weekly slots
  return_aug_sep: 55, // Near-total season loss
  return_jul:     50, // Dead slot Apr–Jun (half H2H season)
  return_jun:     40, // Dead slot Apr–May
  generic_out:    35, // No timeline clue — assume 6+ weeks
} as const;

// ─── Phase boundaries ─────────────────────────────────────────────────────────
// Fraction of user's roster picks that delimit draft phases.
export const PHASE_BOUNDARIES = {
  early_fraction:   0.22, // picks < 22% of roster = early
  middle_fraction:  0.68, // picks < 68% of roster = middle; ≥ = late
  early_min_picks:     4, // always at least 4 picks before "middle" can trigger
  bat_fill_override: 0.75, // if 75%+ batting starter slots filled, escalate to "middle"
} as const;

// ─── Batter evaluation thresholds ────────────────────────────────────────────
// Percentile cutoffs used to flag strengths/weaknesses and assign archetypes.
export const BATTER_THRESHOLDS = {
  strength_pct:       0.68, // percentile >= this → strength flag
  power_archetype:    0.70, // HR pct for "Power patch"
  anchor_threshold:   0.72, // HR+OPS pct for "Middle-order anchor"
  speed_archetype:    0.72, // SB pct for "Speed pressure bat"
  ops_archetype:      0.74, // OPS pct for "OPS stabilizer"
  weakness_pa_pct:    0.35, // PA pct < this → "Lighter volume"
  pa_short_season:   300,   // < 300 PA caution: playing-time lighter
  pa_partial_season: 450,   // < 450 PA caution: missed significant time
} as const;

// ─── Pitcher evaluation thresholds ───────────────────────────────────────────
export const PITCHER_THRESHOLDS = {
  k_strength_pct:    0.70, // K pct >= this → strength flag
  ratio_strength_pct: 0.66, // ERA/WHIP pct >= this → ratios strength
  svhd_strength_pct:  0.70, // RP: SVHD pct >= this → saves/holds flag
  svhd_role_weakness: 0.40, // RP: SVHD pct < this → "Limited saves/holds role"
  sp_ratio_strength:  0.66,
  sp_volume_strength: 0.75, // PA pct → workhorse flag
} as const;

// ─── Category profile leak thresholds ────────────────────────────────────────
// Fraction of pool average below which a drafted category is flagged as "weak".
// ERA/WHIP are flipped: higher is worse.
export const CATEGORY_LEAK = {
  ops:   0.96, // draftedOps < poolOps * 0.96 → weakOps
  power: 0.92, // draftedHr  < poolHr  * 0.92 → weakPower
  speed: 0.88, // draftedSb  < poolSb  * 0.88 → weakSpeed
  k:     0.90, // draftedK   < poolK   * 0.90 → weakStrikeouts
  qs:    0.92, // draftedQs  < poolQs  * 0.92 → weakQs
  era:   1.05, // draftedEra > poolEra * 1.05 → weakRatios
  whip:  1.04, // draftedWhip > poolWhip * 1.04 → weakRatios
  svhd_floor: 0.50, // draftedSvhd < poolSvhd * 0.50 → needsReliefHelp
} as const;

// ─── Positional scarcity bonuses ──────────────────────────────────────────────
// Added to decisionScore when the current tier at a position is nearly exhausted.
export const SCARCITY_BONUSES = {
  tier_cliff_deep_single:  12, // count ≤ 1 and ≥ 2 tier steps to next
  tier_cliff_deep_double:   8, // count ≤ 2 and ≥ 2 tier steps to next
  dwindling_single:         6, // count ≤ 1, only 1 tier step down
  dwindling_triple:         5, // count ≤ 3, ≥ 2 tier steps to next
  dwindling_double:         3, // count ≤ 2, 1 tier step down
} as const;

// ─── ESPN availability thresholds ────────────────────────────────────────────
export const ESPN_THRESHOLDS = {
  screen_visible: 20, // First ~20 ESPN ranks are on every opponent's default screen
  expert_known:   25, // Top-25 expert rank → always targeted by prepared managers
  bubble_buffer:   6, // rank ≤ windowPicks + 6 → "fragile"
  now_rank:        3, // rank ≤ 3 while on clock → "now"
} as const;

// ─── Expert rank modifiers (pitcher only) ────────────────────────────────────
export const PITCHER_EXPERT_MODIFIERS = {
  no_rank:  -6, // Absent from expert top-75 consensus
  top_15:   10,
  top_30:    7,
  top_50:    4,
  beyond:    2,
} as const;

// ─── Draft context adjustments ────────────────────────────────────────────────
// All values added to (or subtracted from) decisionScore during applyDraftContext.
export const CONTEXT = {
  // Expert rank signal for batters
  batter_no_expert_rank:   -5, // Batter with no expert rank in early/middle rounds

  // Early phase
  early_batter_bonus:       7,
  early_batter_category_anchor: 6, // OPS floor + Power combo
  early_batter_speed_bonus: 2,
  early_sp_first:           4, // First SP picked
  early_sp_extra:           1, // Each subsequent SP
  early_sp_ratios_bonus:    3,
  early_rp_penalty:       -18,
  early_c_penalty:         -9,

  // Middle phase
  middle_bat_target_fraction: 0.55, // Fill 55% of batting starters before pivoting
  middle_batter_thin_bonus:   6,    // Batter when lineup is under-built
  middle_sp_built_bonus:      9,    // First SP when batting lineup is built
  middle_sp_thin_bonus:       4,    // First SP when batting lineup is still thin
  middle_rp_leverage:         6,    // RP when relief count low
  middle_rp_over_penalty:    -6,    // RP when already stocked
  middle_c_open_bonus:        8,    // Catcher when C slot is open
  middle_c_early_penalty:    -5,    // Catcher when batting lineup still thin
  middle_speed_patch:         7,
  middle_ops_stabilizer:      7,
  middle_power_support:       5,
  middle_ratio_shield:        6,

  // Late phase
  late_rp_first_3:            9,  // RP when we have < 3 relievers
  late_rp_additional:         4,  // RP when already have 3+
  late_sp_category_need:      5,  // SP when weak strikeouts or QS
  late_sp_base:               2,
  late_c_last_slot:          14,  // Must-fill C slot
  late_speed_weak:            8,
  late_speed_ok:              3,
  late_power_weak:            6,
  late_power_ok:              2,

  // General
  open_slot_bonus:            2,
  flex_slot_bonus:            1,
  positional_crowd_penalty:  -3,  // Same non-OF position drafted 2+ times
  caution_penalty:           -3,  // Player with injury/volume caution flag (non-late)
} as const;

// ─── ADP availability modifier ────────────────────────────────────────────────
// Adjusts decisionScore based on how far ahead of or past ADP the current pick is.
// adpBuffer = player.adp - currentPick
//   positive → being picked ahead of schedule (safe to wait, penalize)
//   negative → being picked past ADP (gone risk, reward)
export const ADP_BUFFER = {
  safe_threshold:      40, // adpBuffer > 40 → well ahead of ADP, safe to wait
  available_threshold: 20, // adpBuffer > 20 → some runway, likely available
  overdue_threshold:   -5, // adpBuffer < -5 → past ADP, elevated departure risk
  critical_threshold: -15, // adpBuffer < -15 → critically overdue
  safe_penalty:        -8,
  available_penalty:   -4,
  overdue_bonus:        8,
  critical_bonus:      12,
} as const;

// ─── Advice prompt thresholds ─────────────────────────────────────────────────
// Used in advice.ts to describe the current roster state in plain language.
export const ADVICE = {
  // Batter category grades
  ops_strong:   0.830,
  ops_adequate: 0.780,
  hr_strong:    28,
  hr_adequate:  22,
  sb_strong:    60,
  sb_adequate:  35,

  // Pitcher category grades
  era_strong:   3.40,
  era_adequate: 3.80,
  whip_strong:  1.15,
  whip_adequate: 1.22,
  k_strong:     400,
  k_building:   250,
  svhd_started:  20,

  // Value gap thresholds (min score gap to surface position urgency)
  value_gap_early:  8, // rounds 1-6
  value_gap_mid:    6, // rounds 7-9
  value_gap_late:   5, // rounds 10+
  value_gap_round_mid:  7, // round >= 7 triggers mid threshold
  value_gap_round_late: 10, // round >= 10 triggers late threshold
} as const;
