/**
 * Narrative Engine for Dynamic Play-by-Play Text
 *
 * Transforms boring stat-based outcomes into epic RPG combat descriptions
 * Text scales with player stats to create progression feel
 */

import { Player, BatterStats, PitcherStats } from "@/types/game";
import { AtBatResult } from "./atBatSimulator";
import { RandomProvider, getDefaultRandomProvider } from "./randomProvider";
import {
  POWER_VERBS,
  CONTACT_VERBS,
  HIT_ADJECTIVES,
  BALL_DESCRIPTORS,
  STRIKEOUT_TEXTS,
  WALK_TEXTS,
  OUT_TEXTS,
  CRITICAL_HIT_PREFIXES,
  BATTER_HISTORY_TEXTS,
  APPROACH_TEXTS,
  getVerbTier,
  randomChoice,
} from "./textPools";
import { calculatePlayerStatsWithEquipment } from "./itemStatsCalculator";
import type { ActiveAbilityContext } from "@/types/ability";
import type { BatterApproach, PitchStrategy } from "@/types/approach";
import { getAbilityById } from "@/data/abilities";
import { evaluateNarrativeRules } from "./narrative/narrativeRules";
import type { NarrativeContext } from "./narrative/narrativeContext";

/**
 * Game-situation state passed from the match engine for context-aware narrative.
 * All fields are optional — narrativeEngine degrades gracefully without them.
 */
export interface NarrativeGameState {
  inning?: number;
  scoreDiff?: number;   // offense POV: positive = offense winning
  bases?: [boolean, boolean, boolean];
}

/**
 * Tracks a batter's cumulative stats across the full game.
 * Used to add contextual flavor (slumps, hot streaks, redemption) to narrative text.
 */
export interface BatterHistory {
  abs: number;        // At-bats so far this game
  hits: number;       // Hits so far
  strikeouts: number; // Strikeouts so far
  walks: number;      // Walks so far
}

/**
 * Fills {name}, {abs}, {k}, {hits} tokens in a batter history template string.
 */
function fillHistoryTemplate(
  template: string,
  surname: string,
  history: BatterHistory
): string {
  return template
    .replace("{name}", surname)
    .replace("{abs}", String(history.abs))
    .replace("{k}", String(history.strikeouts))
    .replace("{hits}", String(history.hits));
}

/**
 * Generates a short context prefix based on batter's game history.
 * Picks randomly from pools in textPools.ts — add new strings there.
 * Returns empty string if nothing notable yet (first 2 ABs always clean).
 */
export function generateBatterHistoryPrefix(
  batter: Player,
  history: BatterHistory,
  rng: RandomProvider = getDefaultRandomProvider()
): string {
  const { abs, hits, strikeouts } = history;

  // Only kick in after 2+ ABs so first PA is always clean
  if (abs < 2) return "";

  const surname = batter.surname;
  let pool: string[] | null = null;

  // Redemption setup — 0-for-3+ with multiple Ks (most specific, check first)
  if (abs >= 3 && hits === 0 && strikeouts >= 2) {
    pool = BATTER_HISTORY_TEXTS.redemption;
  }
  // Hitless but not necessarily striking out
  else if (abs >= 2 && hits === 0) {
    pool = BATTER_HISTORY_TEXTS.hitless;
  }
  // Struggling — multiple Ks even with some hits
  else if (strikeouts >= 3 && hits <= 1) {
    pool = BATTER_HISTORY_TEXTS.struggling;
  }
  // Hot — 2+ hits, pay it off
  else if (hits >= 2) {
    pool = BATTER_HISTORY_TEXTS.hot;
  }

  if (!pool) return "";

  const filled = fillHistoryTemplate(randomChoice(pool, rng), surname, history);
  return filled.endsWith(" ") ? filled : `${filled} `;
}

/**
 * Generate narrative text for an at-bat result.
 *
 * Runs through the narrative rules engine first (situation-aware text),
 * falls back to stat-tier generators for everything else.
 */
export function generateNarrativeText(
  result: AtBatResult,
  batter: Player,
  pitcher: Player,
  outs: number,
  rng: RandomProvider = getDefaultRandomProvider(),
  batterAbility?: ActiveAbilityContext,
  pitcherAbility?: ActiveAbilityContext,
  clashOccurred: boolean = false,
  batterApproach?: BatterApproach,
  pitchStrategy?: PitchStrategy,
  runsScored: number = 0,
  narrativeFlags?: { perfectContact?: boolean; paintedCorner?: boolean },
  batterHistory?: BatterHistory,
  gameState?: NarrativeGameState
): string {
  // Get effective stats including equipment
  const batterStats = calculatePlayerStatsWithEquipment(batter) as BatterStats;
  const pitcherStats = calculatePlayerStatsWithEquipment(pitcher) as PitcherStats;

  // Roll for critical hit (5% base chance, +1% per 10 power over 50)
  const critChance = 5 + Math.max(0, (batterStats.power - 50) / 10);
  const isCritical = rng.random() * 100 < critChance;

  // Generate approach/strategy flavor (subtle, before ability callouts)
  // Picks randomly from pools in textPools.ts — add new strings there.
  const fillApproach = (template: string) =>
    template
      .replace("{batter}", batter.surname)
      .replace("{pitcher}", pitcher.surname);

  let approachFlavor = "";
  if (batterApproach === "power") {
    approachFlavor = fillApproach(randomChoice(APPROACH_TEXTS.batterPower, rng)) + " ";
  } else if (batterApproach === "patient") {
    approachFlavor = fillApproach(randomChoice(APPROACH_TEXTS.batterPatient, rng)) + " ";
  }
  if (pitchStrategy === "finesse") {
    approachFlavor += fillApproach(randomChoice(APPROACH_TEXTS.pitcherFinesse, rng)) + " ";
  } else if (pitchStrategy === "paint") {
    approachFlavor += fillApproach(randomChoice(APPROACH_TEXTS.pitcherPaint, rng)) + " ";
  }

  // Zone read natural 20 flavor — overrides approach flavor when present
  if (narrativeFlags?.perfectContact) {
    approachFlavor = fillApproach(randomChoice(APPROACH_TEXTS.perfectContact, rng)) + " ";
  } else if (narrativeFlags?.paintedCorner) {
    approachFlavor = fillApproach(randomChoice(APPROACH_TEXTS.paintedCorner, rng)) + " ";
  }

  // Generate ability prefix if abilities were used
  let abilityPrefix = "";

  // Clash callout — dramatic moment when both sides use guaranteed abilities.
  // When a clash occurs, the header already names both abilities, so skip the
  // individual callouts and suppress approach flavor to keep it clean.
  const isClash = clashOccurred && !!batterAbility && !!pitcherAbility;
  if (isClash) {
    const batterAbilityDef = getAbilityById(batterAbility!.abilityId);
    const pitcherAbilityDef = getAbilityById(pitcherAbility!.abilityId);
    const batterName = batterAbilityDef?.name.toUpperCase() ?? "ABILITY";
    const pitcherName = pitcherAbilityDef?.name.toUpperCase() ?? "ABILITY";
    abilityPrefix = `ABILITY CLASH! ${batterName} vs ${pitcherName}!\n`;
  } else {
    if (batterAbility) {
      const ability = getAbilityById(batterAbility.abilityId);
      if (ability) {
        abilityPrefix += `${batter.name} uses ${ability.name.toUpperCase()}! `;
      }
    }
    if (pitcherAbility) {
      const ability = getAbilityById(pitcherAbility.abilityId);
      if (ability) {
        if (abilityPrefix) {
          abilityPrefix += `\n${pitcher.name} counters with ${ability.name.toUpperCase()}! `;
        } else {
          abilityPrefix += `${pitcher.name} uses ${ability.name.toUpperCase()}! `;
        }
      }
    }
  }

  // ── Narrative rules engine ─────────────────────────────────────────────────
  // Build context and run situation-aware rules first.
  // Rules return a complete outcome string; null means fall through to
  // the stat-tier generators below.
  const narrativeCtx: NarrativeContext = {
    result,
    runsScored,
    inning: gameState?.inning ?? 1,
    outs,
    scoreDiff: gameState?.scoreDiff ?? 0,
    bases: gameState?.bases ?? [false, false, false],
    batterName: batter.surname,
    pitcherName: pitcher.surname,
    batterPower: batterStats.power,
    batterContact: batterStats.contact,
    pitcherVelocity: (pitcherStats as { velocity?: number }).velocity ?? 50,
    pitcherControl: (pitcherStats as { control?: number }).control ?? 50,
    isCritical,
    batterHistory,
  };

  let outcomeText = evaluateNarrativeRules(narrativeCtx, rng) ?? "";

  // ── Stat-tier fallback generators ─────────────────────────────────────────
  // Used when no situational rule matched.
  if (!outcomeText) {
    switch (result) {
      case "homerun":
        outcomeText = generateHomeRunText(batter, pitcher, batterStats, isCritical, rng);
        break;
      case "triple":
        outcomeText = generateTripleText(batter, batterStats, isCritical, rng);
        break;
      case "double":
        outcomeText = generateDoubleText(batter, batterStats, isCritical, rng);
        break;
      case "single":
        outcomeText = generateSingleText(batter, batterStats, rng);
        break;
      case "strikeout":
        outcomeText = generateStrikeoutText(batter, pitcher, pitcherStats, rng);
        break;
      case "walk":
        outcomeText = generateWalkText(batter, pitcher, pitcherStats, rng);
        break;
      case "groundout":
      case "flyout":
      case "lineout":
      case "popout":
        outcomeText = generateOutText(result, batter, outs, rng);
        break;
      default:
        outcomeText = `${batter.name} - ${result}`;
    }

    // Append run-scoring info (only for stat-tier fallback;
    // situational rules include run context in their text)
    if (runsScored > 0) {
      if (result === "homerun") {
        if (runsScored >= 4) outcomeText += " GRAND SLAM!";
        else if (runsScored === 3) outcomeText += " 3 runs score!";
        else if (runsScored === 2) outcomeText += " 2 runs score!";
      } else {
        if (runsScored === 1) outcomeText += " A run scores!";
        else outcomeText += ` ${runsScored} runs score!`;
      }
    }
  }

  // History context — prepended when batter has a notable game narrative
  const historyPrefix = batterHistory
    ? generateBatterHistoryPrefix(batter, batterHistory, rng)
    : "";

  const prefix = [isClash ? "" : (historyPrefix || approachFlavor), abilityPrefix].filter(Boolean).join("");
  return prefix ? `${prefix}\n${outcomeText}` : outcomeText;
}

/**
 * Generate home run text
 */
function generateHomeRunText(
  batter: Player,
  pitcher: Player,
  batterStats: BatterStats,
  isCritical: boolean,
  rng: RandomProvider
): string {
  const tier = getVerbTier(batterStats.power);
  const verb = randomChoice(POWER_VERBS[tier], rng);
  const adjective = randomChoice(HIT_ADJECTIVES.homerun, rng);
  const ballDesc = randomChoice(BALL_DESCRIPTORS[tier], rng);

  let text = `${batter.name} ${verb} ${adjective} ${ballDesc}!`;

  // Add flourish for high power
  if (batterStats.power >= 100) {
    text += " The stadium TREMBLES!";
  } else if (batterStats.power >= 80) {
    text += " IT'S GONE!";
  } else {
    text += " Home run!";
  }

  // Add critical hit prefix
  if (isCritical) {
    const prefix = randomChoice(CRITICAL_HIT_PREFIXES, rng);
    text = `${prefix}\n${text}`;
  }

  // Add pitcher reaction for legendary hits
  if (batterStats.power >= 100) {
    const reactions = [
      `${pitcher.name} questions their life choices.`,
      `${pitcher.name}'s ego has been SHATTERED.`,
      `${pitcher.name} witnesses their own mortality.`,
    ];
    text += ` ${randomChoice(reactions, rng)}`;
  }

  return text;
}

/**
 * Generate triple text
 */
function generateTripleText(
  batter: Player,
  batterStats: BatterStats,
  isCritical: boolean,
  rng: RandomProvider
): string {
  const tier = getVerbTier(batterStats.power);
  const verb = randomChoice(POWER_VERBS[tier], rng);
  const adjective = randomChoice(HIT_ADJECTIVES.triple, rng);

  let text = `${batter.name} ${verb} ${adjective} triple into the gap!`;

  if (isCritical) {
    const prefix = randomChoice(CRITICAL_HIT_PREFIXES, rng);
    text = `${prefix}\n${text}`;
  }

  return text;
}

/**
 * Generate double text
 */
function generateDoubleText(
  batter: Player,
  batterStats: BatterStats,
  isCritical: boolean,
  rng: RandomProvider
): string {
  const tier = getVerbTier(batterStats.power);
  const verb = randomChoice(POWER_VERBS[tier], rng);
  const adjective = randomChoice(HIT_ADJECTIVES.double, rng);

  let text = `${batter.name} ${verb} ${adjective} double!`;

  if (isCritical) {
    const prefix = randomChoice(CRITICAL_HIT_PREFIXES, rng);
    text = `${prefix}\n${text}`;
  }

  return text;
}

/**
 * Generate single text
 */
function generateSingleText(
  batter: Player,
  batterStats: BatterStats,
  rng: RandomProvider
): string {
  const tier = getVerbTier(batterStats.contact);
  const verb = randomChoice(CONTACT_VERBS[tier], rng);
  const adjective = randomChoice(HIT_ADJECTIVES.single, rng);

  if (tier === "legendary") {
    return `${batter.name} ${verb} the pitch for ${adjective} single. PERFECTION!`;
  } else if (tier === "high") {
    return `${batter.name} ${verb} ${adjective} single.`;
  } else {
    return `${batter.name} hits ${adjective} single.`;
  }
}

/**
 * Generate strikeout text
 */
function generateStrikeoutText(
  batter: Player,
  pitcher: Player,
  pitcherStats: PitcherStats,
  rng: RandomProvider
): string {
  const tier = getVerbTier(pitcherStats.velocity);
  const templates = STRIKEOUT_TEXTS[`pitcher_${tier}` as keyof typeof STRIKEOUT_TEXTS];
  const template = randomChoice(templates, rng);

  return template
    .replace("{batter}", batter.name)
    .replace("{pitcher}", pitcher.name);
}

/**
 * Generate walk text
 */
function generateWalkText(
  batter: Player,
  pitcher: Player,
  pitcherStats: PitcherStats,
  rng: RandomProvider
): string {
  // Inverse logic: lower control = worse tier
  const controlTier = pitcherStats.control >= 80 ? "high" :
                      pitcherStats.control >= 50 ? "mid" : "low";
  const templates = WALK_TEXTS[`control_${controlTier}` as keyof typeof WALK_TEXTS];
  const template = randomChoice(templates, rng);

  return template
    .replace("{batter}", batter.name)
    .replace("{pitcher}", pitcher.name);
}

/**
 * Generate out text
 */
function generateOutText(
  outType: "groundout" | "flyout" | "lineout" | "popout",
  batter: Player,
  outs: number,
  rng: RandomProvider
): string {
  const templates = OUT_TEXTS[outType];
  const template = randomChoice(templates, rng);

  return template
    .replace("{batter}", batter.name)
    .replace("{outs}", outs.toString());
}

/**
 * Generate flavor text for special situations
 */
export function generateSituationalFlavor(
  basesOccupied: number,
  score: { offense: number; defense: number },
  inning: number,
  rng: RandomProvider = getDefaultRandomProvider()
): string | null {
  // Clutch situation: close game, late innings, runners on base
  const isCloseGame = Math.abs(score.offense - score.defense) <= 2;
  const isLateInning = inning >= 7;
  const runnersInScoring = basesOccupied >= 2;

  if (isCloseGame && isLateInning && runnersInScoring && rng.random() < 0.3) {
    const clutchTexts = [
      "⚡ CLUTCH SITUATION ⚡",
      "🔥 HIGH PRESSURE 🔥",
      "💎 CHAMPIONSHIP MOMENT 💎",
      "⭐ HERO TIME ⭐",
    ];
    return randomChoice(clutchTexts, rng);
  }

  return null;
}
