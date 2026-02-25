import { Player, BatterStats, PitcherStats, isBatter } from "@/types/game";
import { applyPitcherFatigue } from "./gameModifiers";
import { GAME_CONSTANTS } from "./constants";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";
import { calculatePlayerStatsWithEquipment } from "./itemStatsCalculator";
import { getArchetypeBaseStats, calculateTechniqueBonus, calculateEquipmentBonus } from "./techniqueStats";
import type { ActiveAbilityContext } from "@/types/ability";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import { BATTER_APPROACHES, PITCH_STRATEGIES } from "./approachConfig";
import {
  applyBatterAbilityEffects,
  applyPitcherAbilityEffects,
  applyOutcomeModifiers,
  getGuaranteedOutcome,
  rollGuaranteedOutcome,
  resolveMultiOutcome,
  getGuaranteedOutcomePower,
  negatesFatigue,
} from "./abilityEffects";
import { getTrace } from "./traceContext";
import type { ActiveSynergies } from "./synergySystem";

export type AtBatResult =
  | "strikeout"
  | "walk"
  | "single"
  | "double"
  | "triple"
  | "homerun"
  | "groundout"
  | "flyout"
  | "lineout"
  | "popout";

/**
 * Full result of an at-bat simulation, including metadata about ability clashes
 */
export interface SimulatedAtBat {
  result: AtBatResult;
  clashOccurred: boolean;
}

/**
 * Calculates the effective stats for a batter including equipment bonuses, approach modifiers, and ability effects.
 * The adaptation multiplier scales down stat modifiers when the same approach is used consecutively.
 */
function getBatterEffectiveStats(
  batter: Player,
  activeAbility?: ActiveAbilityContext,
  approach?: BatterApproach,
  approachAdaptation: number = 1.0,
  synergies?: ActiveSynergies
) {
  const trace = getTrace();

  // Compute trace-friendly pipeline: archetype base -> +techniques -> +equipment (derived)
  const archetypeBase = getArchetypeBaseStats(batter) as BatterStats;
  const techBonus = calculateTechniqueBonus(batter.abilities || []) as Partial<BatterStats>;
  const statsWithTechniques = {
    power: Math.max(0, Math.min(100, (archetypeBase.power || 0) + (techBonus.power || 0))),
    contact: Math.max(0, Math.min(100, (archetypeBase.contact || 0) + (techBonus.contact || 0))),
  };
  const statsWithEquipment = calculatePlayerStatsWithEquipment(
    batter
  ) as BatterStats;

  // Apply synergy bonuses (step 3.5: after equipment, before approach)
  let stats = { ...statsWithEquipment };
  if (synergies) {
    const sb = synergies.batterStatBonuses;
    stats.power += sb.power;
    stats.contact += sb.contact;
    stats.glove += sb.glove;
    stats.speed += sb.speed;
  }

  // Apply approach modifiers BEFORE ability effects, scaled by adaptation
  if (approach) {
    const config = BATTER_APPROACHES[approach];
    if (config) {
      stats.power = Math.max(1, stats.power + Math.round((config.statModifiers.power ?? 0) * approachAdaptation));
      stats.contact = Math.max(1, stats.contact + Math.round((config.statModifiers.contact ?? 0) * approachAdaptation));
    }
  }

  const statsWithApproach = { power: stats.power, contact: stats.contact };

  // Apply ability effects (stacks on top of approach)
  const statsWithAbilities = applyBatterAbilityEffects(stats, activeAbility);

  if (trace) {
    trace.logStatPipeline({
      batter: {
        base: { power: archetypeBase.power, contact: archetypeBase.contact },
        withTechniques: statsWithTechniques,
        withEquipment: { power: statsWithEquipment.power, contact: statsWithEquipment.contact },
        withApproach: statsWithApproach,
        withAbility: { power: statsWithAbilities.power, contact: statsWithAbilities.contact },
      },
      pitcher: {
        base: { velocity: 0, control: 0, break: 0 },
        withTechniques: { velocity: 0, control: 0, break: 0 },
        withEquipment: { velocity: 0, control: 0, break: 0 },
        withFatigue: { velocity: 0, control: 0, break: 0 },
        withStrategy: { velocity: 0, control: 0, break: 0 },
        withAbility: { velocity: 0, control: 0, break: 0 },
      },
      defenseGlove: 0,
    });
  }

  return {
    power: statsWithAbilities.power,
    contact: statsWithAbilities.contact,
  };
}

/**
 * Calculates the effective stats for a pitcher accounting for equipment bonuses,
 * in-game fatigue (including extra fatigue from Patient at-bats and Paint cost),
 * strategy modifiers, and ability effects.
 * The adaptation multiplier scales down stat modifiers when the same strategy is used consecutively.
 */
function getPitcherEffectiveStats(
  pitcher: Player,
  inningsPitched: number,
  activeAbility?: ActiveAbilityContext,
  strategy?: PitchStrategy,
  extraFatigue: number = 0,
  strategyAdaptation: number = 1.0,
  synergies?: ActiveSynergies
) {
  // Compute trace-friendly pipeline: archetype base -> +techniques -> +equipment (derived)
  const archetypeBase = getArchetypeBaseStats(pitcher) as PitcherStats;
  const techBonus = calculateTechniqueBonus(pitcher.abilities || []) as Partial<PitcherStats>;
  const statsWithTechniques = {
    velocity: Math.max(0, Math.min(100, (archetypeBase.velocity || 0) + (techBonus.velocity || 0))),
    control: Math.max(0, Math.min(100, (archetypeBase.control || 0) + (techBonus.control || 0))),
    break: Math.max(0, Math.min(100, (archetypeBase.break || 0) + (techBonus.break || 0))),
  };
  const statsWithEquipment = calculatePlayerStatsWithEquipment(
    pitcher
  ) as PitcherStats;

  // Apply synergy bonuses (step 3.5: after equipment, before fatigue)
  let preStats = { ...statsWithEquipment };
  if (synergies) {
    const sb = synergies.pitcherStatBonuses;
    preStats.velocity += sb.velocity;
    preStats.control += sb.control;
    preStats.break += sb.break;
  }

  // Apply fatigue unless ability negates it (Time Warp / Iron Arm)
  // extraFatigue comes from accumulated Patient at-bats and Paint self-cost
  const shouldApplyFatigue = !negatesFatigue(activeAbility);
  const effectiveInningsPitched = inningsPitched + extraFatigue;
  const statsWithFatigue = shouldApplyFatigue
    ? {
        velocity: applyPitcherFatigue(preStats.velocity, effectiveInningsPitched),
        control: applyPitcherFatigue(preStats.control, effectiveInningsPitched),
        break: applyPitcherFatigue(preStats.break, effectiveInningsPitched),
      }
    : { ...preStats };

  // Apply strategy modifiers after fatigue, BEFORE ability effects, scaled by adaptation
  let stats = { ...statsWithFatigue };
  if (strategy) {
    const config = PITCH_STRATEGIES[strategy];
    if (config) {
      stats.velocity = Math.max(1, stats.velocity + Math.round((config.statModifiers.velocity ?? 0) * strategyAdaptation));
      stats.control = Math.max(1, stats.control + Math.round((config.statModifiers.control ?? 0) * strategyAdaptation));
      stats.break = Math.max(1, stats.break + Math.round((config.statModifiers.break ?? 0) * strategyAdaptation));
    }
  }

  const statsWithStrategy = { velocity: stats.velocity, control: stats.control, break: stats.break };

  // Apply ability effects (stacks on top of strategy)
  const statsWithAbilities = applyPitcherAbilityEffects(stats, activeAbility);

  // Merge pitcher pipeline into existing trace stat pipeline
  const trace = getTrace();
  if (trace) {
    // Stage the pitcher portion of the pipeline (batter side was set by getBatterEffectiveStats)
    trace._pendingPitcherPipeline = {
      base: { velocity: archetypeBase.velocity, control: archetypeBase.control, break: archetypeBase.break },
      withTechniques: statsWithTechniques,
      withEquipment: { velocity: statsWithEquipment.velocity, control: statsWithEquipment.control, break: statsWithEquipment.break },
      withFatigue: { velocity: statsWithFatigue.velocity, control: statsWithFatigue.control, break: statsWithFatigue.break },
      withStrategy: statsWithStrategy,
      withAbility: { velocity: statsWithAbilities.velocity, control: statsWithAbilities.control, break: statsWithAbilities.break },
    };
  }

  return {
    velocity: statsWithAbilities.velocity,
    control: statsWithAbilities.control,
    break: statsWithAbilities.break,
  };
}

/**
 * Calculates the average defensive glove rating for the defense including equipment bonuses and ability effects
 */
function getDefenseEffectiveGlove(
  defense: Player[],
  activeAbility?: ActiveAbilityContext
): number {
  const totalGlove = defense.reduce((sum, p) => {
    if (isBatter(p)) {
      const statsWithEquipment = calculatePlayerStatsWithEquipment(
        p
      ) as BatterStats;
      return sum + statsWithEquipment.glove;
    }
    return sum;
  }, 0);

  const baseGlove = totalGlove / defense.length;

  // Apply defensive boost if ability has it
  return applyOutcomeModifiers(baseGlove, "defense", activeAbility);
}

/**
 * Calculates strikeout probability
 */
function calculateStrikeoutChance(
  pitcherVelocity: number,
  pitcherBreak: number,
  pitcherControl: number,
  batterContact: number
): number {
  const controlContribution = pitcherControl * GAME_CONSTANTS.AT_BAT.STRIKEOUT_CONTROL_WEIGHT;
  return Math.max(
    0,
    (pitcherVelocity + pitcherBreak + controlContribution - batterContact) /
      GAME_CONSTANTS.AT_BAT.STRIKEOUT_DIVISOR
  );
}

/**
 * Calculates walk probability from two independent components:
 * 1. Pitcher wildness: low control = walks regardless of batter
 * 2. Batter discipline: high contact batters work counts better
 */
function calculateWalkChance(
  batterContact: number,
  pitcherControl: number
): number {
  const { WALK_WILDNESS_DIVISOR, WALK_DISCIPLINE_DIVISOR, WALK_DISCIPLINE_THRESHOLD } = GAME_CONSTANTS.AT_BAT;
  const pitcherWildness = (100 - pitcherControl) / WALK_WILDNESS_DIVISOR;
  const batterDiscipline = Math.max(0, batterContact - WALK_DISCIPLINE_THRESHOLD) / WALK_DISCIPLINE_DIVISOR;
  return pitcherWildness + batterDiscipline;
}

/**
 * Calculates the net score for determining hit outcomes
 */
export function calculateNetScore(
  batterPower: number,
  batterContact: number,
  pitcherVelocity: number,
  pitcherBreak: number,
  pitcherControl: number,
  defenseGlove: number
): number {
  const batterScore =
    (batterPower + batterContact) *
    GAME_CONSTANTS.AT_BAT.BATTER_SCORE_MULTIPLIER;
  const pitcherScore =
    (pitcherVelocity + pitcherBreak + pitcherControl) *
    GAME_CONSTANTS.AT_BAT.PITCHER_SCORE_MULTIPLIER;
  const defenseScore =
    defenseGlove * GAME_CONSTANTS.AT_BAT.DEFENSE_SCORE_MULTIPLIER;

  // Clamp to prevent extreme advantages
  return Math.max(
    GAME_CONSTANTS.AT_BAT.MIN_NET_SCORE,
    Math.min(
      GAME_CONSTANTS.AT_BAT.MAX_NET_SCORE,
      batterScore - pitcherScore - defenseScore
    )
  );
}

/**
 * Determines specific out type based on weighted probabilities
 */
export function determineOutType(rng: RandomProvider): AtBatResult {
  const roll = rng.random();
  const outTypes = GAME_CONSTANTS.AT_BAT.OUT_TYPES;

  const trace = getTrace();
  const result: AtBatResult =
    roll < outTypes.GROUNDOUT ? "groundout" :
    roll < outTypes.GROUNDOUT + outTypes.FLYOUT ? "flyout" :
    roll < outTypes.GROUNDOUT + outTypes.FLYOUT + outTypes.LINEOUT ? "lineout" :
    "popout";

  trace?.logRoll("out_type", roll, undefined, undefined, true);

  return result;
}

/**
 * Determines hit outcome based on roll and net score
 */
export function determineHitOutcome(
  hitRoll: number,
  rng: RandomProvider
): AtBatResult {
  if (hitRoll > GAME_CONSTANTS.AT_BAT.HOMERUN_THRESHOLD) return "homerun";
  if (hitRoll > GAME_CONSTANTS.AT_BAT.TRIPLE_THRESHOLD) return "triple";
  if (hitRoll > GAME_CONSTANTS.AT_BAT.DOUBLE_THRESHOLD) return "double";
  if (hitRoll > GAME_CONSTANTS.AT_BAT.SINGLE_THRESHOLD) return "single";
  return determineOutType(rng);
}

/**
 * Simulates a single at-bat between batter and pitcher
 *
 * This is the core gameplay mechanic. The process:
 * 1. Check for guaranteed outcomes (from abilities) — with clash resolution if both sides have one
 * 2. Calculate effective stats (with equipment, fatigue, and ability modifiers)
 * 3. Apply outcome modifiers (from abilities)
 * 4. Resolve at-bat result
 *
 * @param batter - The batter
 * @param pitcher - The pitcher
 * @param defense - The defensive players
 * @param pitcherInningsPitched - Innings pitched by pitcher in current game
 * @param rng - Optional random provider (defaults to Math.random())
 * @param batterAbility - Optional active ability for batter
 * @param pitcherAbility - Optional active ability for pitcher
 * @param batterApproach - Batter's chosen approach
 * @param pitchStrategy - Pitcher's chosen strategy
 * @param extraPitcherFatigue - Accumulated extra fatigue from Patient at-bats and Paint self-cost
 * @param approachAdaptation - Multiplier (0-1) for batter approach stat modifiers (adaptation penalty)
 * @param strategyAdaptation - Multiplier (0-1) for pitcher strategy stat modifiers (adaptation penalty)
 *
 * Note: Repertoire passive (Trickster) requires match engine to track previousAbilityId.
 * The penalty is applied via applyRepertoirePenalty() in the match engine before calling this function.
 */
export function simulateAtBat(
  batter: Player,
  pitcher: Player,
  defense: Player[],
  pitcherInningsPitched: number = 0,
  rng: RandomProvider = getDefaultRandomProvider(),
  batterAbility?: ActiveAbilityContext,
  pitcherAbility?: ActiveAbilityContext,
  batterApproach?: BatterApproach,
  pitchStrategy?: PitchStrategy,
  extraPitcherFatigue: number = 0,
  approachAdaptation: number = 1.0,
  strategyAdaptation: number = 1.0,
  offenseSynergies?: ActiveSynergies,
  defenseSynergies?: ActiveSynergies,
  additionalOutcomeModifiers?: {
    strikeoutBonus?: number;
    hitBonus?: number;
    homerunBonus?: number;
    walkBonus?: number;
  }
): SimulatedAtBat {
  const trace = getTrace();

  const batterGuaranteed = getGuaranteedOutcome(batterAbility);
  const pitcherGuaranteed = getGuaranteedOutcome(pitcherAbility);

  // ── CLASH: Both sides have guaranteed outcomes ──
  if (batterGuaranteed && pitcherGuaranteed) {
    const batterPower = getGuaranteedOutcomePower(batterGuaranteed);
    const pitcherPower = getGuaranteedOutcomePower(pitcherGuaranteed);

    const bRaw = rng.random();
    const batterRoll = bRaw * batterPower;
    const pRaw = rng.random();
    const pitcherRoll = pRaw * pitcherPower;

    trace?.logRoll("clash_batter", bRaw, batterRoll, pitcherRoll, batterRoll >= pitcherRoll);
    trace?.logRoll("clash_pitcher", pRaw, pitcherRoll, batterRoll, pitcherRoll > batterRoll);

    if (batterRoll >= pitcherRoll) {
      // Batter wins the clash
      const outcomeRaw = rng.random();
      const outcomeRoll = outcomeRaw * 100;
      const result = resolveMultiOutcome(batterGuaranteed, outcomeRoll, true);
      trace?.logResolution({ type: "clash", winner: "batter", batterRoll, pitcherRoll });
      trace?.logRoll("clash_outcome", outcomeRaw, outcomeRoll, undefined, true);
      return { result, clashOccurred: true };
    } else {
      // Pitcher wins the clash
      trace?.logResolution({ type: "clash", winner: "pitcher", batterRoll, pitcherRoll });
      if (pitcherAbility?.abilityId === "total_eclipse") {
        const raw = rng.random();
        const roll = raw * 100;
        trace?.logRoll("total_eclipse", raw, roll, undefined, true);
        if (roll <= 80) return { result: "strikeout", clashOccurred: true };
        if (roll <= 95) return { result: "walk", clashOccurred: true };
        return { result: "single", clashOccurred: true };
      }
      const outcomeRaw = rng.random();
      const outcomeRoll = outcomeRaw * 100;
      const result = resolveMultiOutcome(pitcherGuaranteed, outcomeRoll, false);
      trace?.logRoll("clash_outcome", outcomeRaw, outcomeRoll, undefined, true);
      return { result, clashOccurred: true };
    }
  }

  // ── Batter-only guaranteed outcome ──
  if (batterGuaranteed) {
    const outcomeRaw = rng.random();
    const outcomeRoll = outcomeRaw * 100;
    const result = resolveMultiOutcome(batterGuaranteed, outcomeRoll, true);
    trace?.logResolution({ type: "guaranteed_batter", outcome: result });
    trace?.logRoll("guaranteed_outcome", outcomeRaw, outcomeRoll, undefined, true);
    return { result, clashOccurred: false };
  }

  // ── Pitcher-only guaranteed outcome ──
  if (pitcherGuaranteed) {
    if (pitcherAbility?.abilityId === "total_eclipse") {
      const raw = rng.random();
      const roll = raw * 100;
      trace?.logResolution({ type: "guaranteed_pitcher", outcome: "total_eclipse" });
      trace?.logRoll("total_eclipse", raw, roll, undefined, true);
      if (roll <= 80) return { result: "strikeout", clashOccurred: false };
      if (roll <= 95) return { result: "walk", clashOccurred: false };
      return { result: "single", clashOccurred: false };
    }

    const outcomeRaw = rng.random();
    const outcomeRoll = outcomeRaw * 100;
    const result = resolveMultiOutcome(pitcherGuaranteed, outcomeRoll, false);
    trace?.logResolution({ type: "guaranteed_pitcher", outcome: result });
    trace?.logRoll("guaranteed_outcome", outcomeRaw, outcomeRoll, undefined, true);
    return { result, clashOccurred: false };
  }

  // ── Normal stat-based resolution (no guaranteed outcomes) ──
  trace?.logResolution({ type: "normal" });

  const batterStats = getBatterEffectiveStats(batter, batterAbility, batterApproach, approachAdaptation, offenseSynergies);
  const pitcherStats = getPitcherEffectiveStats(
    pitcher,
    pitcherInningsPitched,
    pitcherAbility,
    pitchStrategy,
    extraPitcherFatigue,
    strategyAdaptation,
    defenseSynergies
  );
  const avgGlove = getDefenseEffectiveGlove(defense, batterAbility);

  // Merge the full stat pipeline now that both sides are computed
  if (trace) {
    trace.mergePitcherPipeline(avgGlove);
  }

  // Collect approach/strategy outcome modifiers
  const approachConfig = batterApproach ? BATTER_APPROACHES[batterApproach] : undefined;
  const strategyConfig = pitchStrategy ? PITCH_STRATEGIES[pitchStrategy] : undefined;

  // Check for strikeout (with ability + synergy + approach/strategy modifiers)
  const baseStrikeout = calculateStrikeoutChance(
    pitcherStats.velocity,
    pitcherStats.break,
    pitcherStats.control,
    batterStats.contact
  );
  let strikeoutChance = baseStrikeout;
  strikeoutChance = applyOutcomeModifiers(strikeoutChance, "strikeout", batterAbility);
  strikeoutChance = applyOutcomeModifiers(strikeoutChance, "strikeout", pitcherAbility);
  // Apply synergy outcome modifiers (offense synergies reduce K, defense synergies increase K)
  if (offenseSynergies) strikeoutChance += offenseSynergies.outcomeModifiers.strikeoutBonus;
  if (defenseSynergies) strikeoutChance += defenseSynergies.outcomeModifiers.strikeoutBonus;
  const strikeoutAfterAbilities = strikeoutChance;
  strikeoutChance += approachConfig?.outcomeModifiers.strikeoutBonus ?? 0;
  strikeoutChance += strategyConfig?.outcomeModifiers.strikeoutBonus ?? 0;
  strikeoutChance += additionalOutcomeModifiers?.strikeoutBonus ?? 0;
  strikeoutChance = Math.max(0, strikeoutChance);

  const strikeoutRaw = rng.random();
  const strikeoutRoll = strikeoutRaw * 100;
  trace?.logRoll("strikeout_check", strikeoutRaw, strikeoutRoll, strikeoutChance, strikeoutRoll < strikeoutChance);

  if (strikeoutRoll < strikeoutChance) {
    if (trace) {
      trace.logOutcomeModifiers({
        strikeoutChance: { base: baseStrikeout, afterAbilities: strikeoutAfterAbilities, afterApproachStrategy: strikeoutChance, final: strikeoutChance },
        walkChance: { base: 0, afterAbilities: 0, afterApproachStrategy: 0, final: 0 },
      });
    }
    return { result: "strikeout", clashOccurred: false };
  }

  // Check for walk (with ability + synergy + approach/strategy modifiers)
  const baseWalk = calculateWalkChance(batterStats.contact, pitcherStats.control);
  let walkChance = baseWalk;
  walkChance = applyOutcomeModifiers(walkChance, "walk", batterAbility);
  walkChance = applyOutcomeModifiers(walkChance, "walk", pitcherAbility);
  // Apply synergy walk modifiers
  if (offenseSynergies) walkChance += offenseSynergies.outcomeModifiers.walkBonus;
  if (defenseSynergies) walkChance += defenseSynergies.outcomeModifiers.walkBonus;
  const walkAfterAbilities = walkChance;
  walkChance += approachConfig?.outcomeModifiers.walkBonus ?? 0;
  walkChance += strategyConfig?.outcomeModifiers.walkBonus ?? 0;
  walkChance += additionalOutcomeModifiers?.walkBonus ?? 0;
  walkChance = Math.max(0, walkChance);

  const walkRaw = rng.random();
  const walkRoll = walkRaw * 100;
  trace?.logRoll("walk_check", walkRaw, walkRoll, walkChance, walkRoll < walkChance);

  if (walkRoll < walkChance) {
    if (trace) {
      trace.logOutcomeModifiers({
        strikeoutChance: { base: baseStrikeout, afterAbilities: strikeoutAfterAbilities, afterApproachStrategy: strikeoutChance, final: strikeoutChance },
        walkChance: { base: baseWalk, afterAbilities: walkAfterAbilities, afterApproachStrategy: walkChance, final: walkChance },
      });
    }
    return { result: "walk", clashOccurred: false };
  }

  // Ball in play - determine hit quality
  const rawNetScore = calculateNetScore(
    batterStats.power,
    batterStats.contact,
    pitcherStats.velocity,
    pitcherStats.break,
    pitcherStats.control,
    avgGlove
  );
  let netScore = rawNetScore;

  // Apply hit quality modifiers from abilities + synergies + approach/strategy
  netScore = applyOutcomeModifiers(netScore, "netScore", batterAbility);
  netScore = applyOutcomeModifiers(netScore, "netScore", pitcherAbility);
  if (offenseSynergies) netScore += offenseSynergies.outcomeModifiers.hitBonus;
  if (defenseSynergies) netScore += defenseSynergies.outcomeModifiers.hitBonus;
  const netScoreAfterAbilities = netScore;
  netScore += approachConfig?.outcomeModifiers.hitBonus ?? 0;
  netScore += strategyConfig?.outcomeModifiers.hitBonus ?? 0;
  netScore += additionalOutcomeModifiers?.hitBonus ?? 0;

  const hitRaw = rng.random();
  const baseHitRoll = hitRaw * 100 + netScore;
  // Power bonus: high power shifts hits toward extra bases (centered on 50 so average power = no effect)
  const powerBonus = (batterStats.power - 50) * GAME_CONSTANTS.AT_BAT.POWER_HIT_BONUS_WEIGHT;
  let hitRoll = baseHitRoll + powerBonus;

  trace?.logRoll("hit_quality", hitRaw, baseHitRoll + powerBonus, undefined, true);

  // Apply homerun bonus modifiers from abilities + synergies + approach/strategy
  hitRoll = applyOutcomeModifiers(hitRoll, "homerun", batterAbility);
  hitRoll = applyOutcomeModifiers(hitRoll, "homerun", pitcherAbility);
  if (offenseSynergies) hitRoll += offenseSynergies.outcomeModifiers.homerunBonus;
  if (defenseSynergies) hitRoll += defenseSynergies.outcomeModifiers.homerunBonus;
  const hitRollAfterAbilities = hitRoll;
  hitRoll += approachConfig?.outcomeModifiers.homerunBonus ?? 0;
  hitRoll += strategyConfig?.outcomeModifiers.homerunBonus ?? 0;
  hitRoll += additionalOutcomeModifiers?.homerunBonus ?? 0;

  if (trace) {
    trace.logOutcomeModifiers({
      strikeoutChance: { base: baseStrikeout, afterAbilities: strikeoutAfterAbilities, afterApproachStrategy: strikeoutChance, final: strikeoutChance },
      walkChance: { base: baseWalk, afterAbilities: walkAfterAbilities, afterApproachStrategy: walkChance, final: walkChance },
      netScore: { raw: rawNetScore, afterAbilities: netScoreAfterAbilities, afterApproachStrategy: netScore, final: netScore },
      hitRoll: { base: baseHitRoll, afterAbilities: hitRollAfterAbilities, afterApproachStrategy: hitRoll, final: hitRoll },
    });

    // Log the hit outcome thresholds
    const T = GAME_CONSTANTS.AT_BAT;
    trace.logRoll("hit_outcome", hitRaw, hitRoll, T.HOMERUN_THRESHOLD,
      hitRoll > T.HOMERUN_THRESHOLD ? true :
      hitRoll > T.TRIPLE_THRESHOLD ? true :
      hitRoll > T.DOUBLE_THRESHOLD ? true :
      hitRoll > T.SINGLE_THRESHOLD ? true : false
    );
  }

  return { result: determineHitOutcome(hitRoll, rng), clashOccurred: false };
}
